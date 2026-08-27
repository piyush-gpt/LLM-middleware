# DECISIONS.md

## What I built

A small HTTP LLM gateway. Callers authenticate with a gateway-issued virtual key (`vk_…`); the real provider credential stays server-side. Each key has a request cap that is enforced before any upstream call. Successful calls are logged (key, model, tokens, estimated USD, timestamp) so spend is queryable via `GET /usage`. If the provider errors or times out, the gateway retries a bounded number of times and then fails fast with a clean `502`, refunding the request so the failure does not cost the caller.

## Request lifecycle

```
client
  │  POST /v1/chat/completions   Authorization: Bearer vk_…
  ▼
gateway
  1. auth     hash the key, look up an active row
  2. budget   atomic claim: UPDATE … WHERE requests_used < request_limit
  3. provider timeout + bounded retry on the chosen model
              if it still fails → refund the claimed slot, 502 (fail fast)
  4. usage    persist tokens + estimated cost  (sync, before the response)
  5. reply    OpenAI-shaped JSON + a small `gateway` block
```

Budget is checked **before** money is spent upstream. The claim and the usage insert are separate statements; a failed provider call refunds the slot so a 502 does not permanently burn quota.

## Important decisions

### 1. Node.js + TypeScript, Express

**Options:** Python/FastAPI vs Node/TypeScript (Express or Fastify).

**Picked:** Node + TypeScript + Express.

This service is I/O-bound: accept HTTP, wait on a provider, write to Postgres, maybe fall back. Node fits that. TypeScript also keeps request shapes, provider results, and budget types honest at compile time.

**Tradeoff:** weaker in-process ML story than Python. Acceptable here, a gateway should call Ollama/vLLM over HTTP, not run inference in process.

### 2. PostgreSQL (not Redis, not Mongo)

**Options:** Postgres, Redis, MongoDB.

**Picked:** Postgres (managed Neon).

The data is relational: keys, budgets, per-request usage, and “how much has key X spent?”. Budget enforcement is a concurrent read-modify-write on one row; a single `UPDATE … WHERE requests_used < request_limit RETURNING …` is atomic and uses Postgres row locks by default. Redis would be a faster hot counter, but a second store for this size. Mongo would fit JSON payloads; it would not make the budget path simpler.

**Tradeoff:** extra latency vs an in memory counter. I thought correctness beat microseconds for this task so didnot use redis for this, but in actual production, would definitely use it.

### 3. Request-count budgets, cost only for observability

**Options:** cap on requests, tokens, or ₹/USD.

**Picked:** request count.

First principle: a budget has to block *before* money is spent, so the only quantity I can enforce with certainty is one that is known before the upstream call. Request count is exactly that, it is `+1` per call, decided up front, with no estimation. Token and dollar caps do not have this property: you do not know real usage until the response comes back, so enforcing on them forces one of two weaker designs. Either you *let the request through and reconcile after*, meaning the very call that breaches the cap has already been paid for or you *pre-reserve* against a guessed `max_tokens` and a hard coded price table that drifts from the provider's real list prices. Both add a reservation/settlement state machine and a new class of "estimate was wrong" bugs, for little gain at this scope.

Crucially, choosing request count for *enforcement* costs me nothing on *visibility*: I still persist tokens in/out and estimated micro USD on every call, so "how much has key X spent?" is already answerable in dollars. The enforcement unit and the accounting unit are decoupled on purpose, moving to a real dollar cap later is a logic change, not a schema change.

**Tradeoff:** one cheap `gpt-4o-mini` call and one expensive `gpt-4o` call burn the same quota, so request count is a crude proxy for actual cost. In production I would reserve estimated cost at claim time, settle against real usage from the response, and enforce a hard dollar cap, the logged fields are already there to support it.

### 4. Non-streaming, OpenAI-compatible schema

**Options:** stream tokens (SSE) vs one JSON body; mimic OpenAI vs invent a schema.

**Picked:** non-streaming `POST /v1/chat/completions`.

Non-streaming is what makes the other three requirements (budgets, failure handling, logging) actually hold together:

- **Clean retry and failure stay possible.** The instant you flush the first SSE chunk you have already sent `200 OK` and committed to that response; if the upstream then dies mid stream you cannot silently retry or return an error, the caller already holds a partial answer. Buffering the full response first lets me detect failure, retry, and then fail fast with a real status *before* a single byte reaches the client. My whole retry/refund policy depends on this.
- **Real HTTP status codes.** Over-budget must *actually block* (429/402), and a dead upstream must surface as a real error (502). Those are response-status decisions, and with streaming the status is locked in before the outcome is known, so rejections have to be smuggled inside the event stream. One JSON response returns an honest `429`/`402`/`502`.
- **One straight line.** `auth → budget claim → provider → log → reply` stays a single sequential path — the clearest possible system-design story — instead of forking into early headers, trickling body, out-of-band errors, and end-of-stream reconciliation.

Streaming's real payoff is token-by-token *UX*, which this brief explicitly does not score ("we do not score UI"). So trading it away to make budget/failure-handling/logging bulletproof is the right call, not a shortcut.

**Tradeoff:** higher time to first byte and no live typing effect; for very long generations the caller waits for the whole body. A real UX cost, just the correct one to sacrifice here, and the first feature I would add for a product.

### 5. Hash virtual keys, never store the raw value

Raw keys are `vk_` + 24 random bytes, shown once at mint time. The database stores only SHA-256. A leaked DB dump is not a leaked keyring.

**Tradeoff:** the gateway cannot show the key again. That is the point.

## Why enforce budgets at the gateway instead of trusting callers

The gateway holds the real provider key, so every call it forwards is billed to us, not the caller. Whoever pays the bill must own the limit.

- **A caller-side limit can't be trusted.** A bug, a retry loop, or a leaked key means the caller blows past the cap — and the charge still lands on us. 
- **The gateway is the one choke point.** Every call passes through it, it holds the credential, and it owns the counter in Postgres, so it's the only place that can actually say no.
- **It blocks before spending.** The slot is claimed *before* the provider call, so an over-budget request is rejected with a 429 having cost nothing. Checking on the client, or after the call, is too late, the money is already spent.

## Concurrency

Two requests on the same nearly-exhausted key: both hash-lookup succeed, then both try to claim.

The claim is one statement:

```sql
UPDATE api_keys
   SET requests_used = requests_used + 1
 WHERE id = $1 AND active AND requests_used < request_limit
RETURNING requests_used, request_limit;
```

Postgres locks that row. One update sees `used < limit` and wins; the other sees the new value and gets zero rows → 429. I did handle this. I did **not** wrap claim + usage insert in one transaction, so a crash between a successful provider call and the log can leave a used slot without a usage row (or, if we refund on log failure, a paid upstream call that no longer counts). Named as a cut.

## Failure policy

1. Call the requested model with a hard timeout (`PROVIDER_TIMEOUT_MS`, default 20s).
2. Retry up to `PROVIDER_MAX_ATTEMPTS` (default 2) to absorb transient blips.
3. If it still fails, **fail fast**: refund the claimed budget slot and return a clean `502` with an error body.

I chose to fail fast rather than serve a mock/stub response. A fake `200` that a caller might treat as a real completion is the wrong kind of success, it hides the outage and can silently corrupt whatever consumes the output. An honest `502` lets the caller retry or degrade on their own terms, and the refund means a dead upstream never costs them a request. The obvious next step for real resilience is not a stub but a **second real provider** (or a local Ollama model) as a genuine fallback; that is wiring on top of the existing model-routing registry, not a redesign.

## What I did not build

- **Streaming**, see above.
- **Cost/token enforcement**, logged, not capped.
- **A second real provider / fallback model**, the gateway fails fast on provider errors today; adding Anthropic or Ollama as a real fallback is wiring on the model registry, not design.
- **Cache, router, Ollama stretch**, core first, as the brief asked.

## Least confident decision

**Fail fast vs. fall back on provider failure.**

I chose fail fast (retry, then `502` + refund). Arguing both sides:

For fail fast: it is honest, a `502` never masquerades as a real completion, so nothing downstream is silently fed a stub. It is simple to reason about, and the refund keeps the caller whole. It needs no second paid provider.

Against: it trades availability for honesty. If the caller genuinely just needs *some* answer (e.g. a low-stakes classification), a real fallback model would keep them working where fail fast returns nothing.

Where I would take it next: keep fail fast as the default, but add a **real** second provider (or local Ollama) to the model registry as a true fallback, and refine retries to only retry timeouts/5xx while failing 4xx immediately (a bad model name should not be retried). The point is that the right answer to an outage is another real model, not a stub.
