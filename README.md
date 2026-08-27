# LLM Gateway

A small HTTP service in front of an LLM provider. Callers use a **virtual key** (`vk_…`). The real provider key never leaves the server.

**Live URL:** https://llm-middleware-lh75.onrender.com

The free Render instance sleeps when idle. The first request after a pause can take ~30–50 seconds.

---

## Routes

### 1. `POST /admin/keys`, mint a virtual key

Creates a key with a request budget. Protected by `x-admin-token`. The raw `api_key` is returned **once**; only a hash is stored.

```bash
curl -X POST https://llm-middleware-lh75.onrender.com/admin/keys \
  -H "x-admin-token: token_for_admin_@@" \
  -H "content-type: application/json" \
  -d '{"name": "demo", "request_limit": 20}'
```

Save `api_key` from the response (`vk_…`).

---

### 2. `POST /v1/chat/completions`, send a chat request

Authenticate with `Authorization: Bearer vk_…`. The gateway hashes the key, **claims one request** on the budget (rejects `429` if over cap), calls the model (timeout + retry), logs tokens/cost, then returns an OpenAI-shaped JSON body.

If the provider fails after retries → **`502`** and the claimed request is **refunded**.

Supported models: `openai/gpt-4o-mini`, `openai/gpt-4o`, `openai/gpt-4.1-mini`, `openai/gpt-3.5-turbo`.

```bash
curl -X POST https://llm-middleware-lh75.onrender.com/v1/chat/completions \
  -H "authorization: Bearer vk_YOUR_KEY" \
  -H "content-type: application/json" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [{"role": "user", "content": "Say hello in one sentence."}]
  }'
```

---

### 3. `GET /usage?key=vk_…`, see spend for a key

Pass the virtual key as the query param (no admin token). Returns requests used vs limit, tokens, and estimated cost.

```bash
curl "https://llm-middleware-lh75.onrender.com/usage?key=vk_YOUR_KEY"
```

---

### 4. `GET /health`

```bash
curl https://llm-middleware-lh75.onrender.com/health
```

---

## Typical flow

1. Admin mints a key (`/admin/keys`).
2. Caller chats with that key (`/v1/chat/completions`).
3. Caller (or you) checks spend (`/usage`).

See [DECISIONS.md](DECISIONS.md) for why budgets, fail fast, and non streaming work this way.
