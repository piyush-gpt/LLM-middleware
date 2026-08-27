# AI-LOG.md

## Tools I used, and for what

I built this in **Cursor**, using **Claude** as the coding assistant. I used it for:

- Scaffolding the Express + TypeScript project and the file layout.
- Writing first drafts of the routes, the atomic budget query, and the provider layer.
- Explaining tradeoffs (streaming vs non streaming, request vs token budgets, fail fast vs fallback) so I could pick and defend a direction.
- Drafting and tightening `DECISIONS.md`.

I treated it as a fast pair-programmer: it wrote a lot of the boilerplate, but I made every design call and reviewed the parts that matter.

## One place the AI was wrong / misleading

When I switched the provider to OpenRouter, the model names became namespaced (`openai/gpt-4o-mini`), but the pricing table still used the bare names (`gpt-4o-mini`). The AI left the two out of sync. Because cost lookup is keyed by model name, this silently fell through to a default price instead of erroring, so it would have looked "fine" while logging wrong costs. I caught it by tracing what model string actually flows from the provider response into the cost function, and realized the keys had to match. Fixed by aligning the pricing keys to the namespaced names.

(Earlier, the AI also initially set the project up as ES modules, which would have broken the compiled `node dist/server.js` run due to missing file extensions. I caught it while thinking through the build step and switched to CommonJS.)

## One place I overrode the AI

The first version fell back to a **mock provider** when the real model failed, returning a normal `200`. I overrode this and switched to **fail fast** (retry, then `502`, and refund the request). A fake success that a caller might treat as a real completion is dishonest and can silently corrupt whatever consumes the output. An error is more useful than a stub. The right answer to an outage is a second *real* model, which I left as a documented next step, not a fake one.

I also removed a graceful shutdown server code block the AI added, as unnecessary complexity for this scope.

## How I stayed in control of the risky parts

- **Secrets:** real keys live only in `.env` (git ignored) and are read through a validated config; nothing sensitive is in the repo. 
- **Budget logic:** I made sure I understood the single atomic `UPDATE … WHERE requests_used < request_limit` and *why* it is race safe (Postgres locks the row, only one update matches), rather than trusting it blindly. I also checked the refund path so a failed call gives the request back.
- **Provider call:** I read the timeout/abort logic and the retry loop line by line, and confirmed the upstream key is attached server side and never returned to the caller.

Rule I followed: if I couldn't explain a piece in my own words, I didn't keep it.

## Something I learned from scratch

**How to enforce a budget safely under concurrency.** My first instinct was "read the counter, check it, then increment", but that has a race: two requests on a nearly exhausted key can both read "ok" and both go through. I learned to do the check and increment as one atomic conditional `UPDATE` that returns the row only if it succeeded. I got up to speed by reasoning through the two-requests-at-once case and confirming how Postgres row locking makes exactly one of them win. I also learned that many providers (OpenRouter, Groq, Gemini, Ollama) speak the OpenAI wire format, which is why the gateway can target one schema and swap providers via a base URL.
