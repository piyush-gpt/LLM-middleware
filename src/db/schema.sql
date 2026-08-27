CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS api_keys (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash       TEXT NOT NULL UNIQUE,
  name           TEXT,
  request_limit  INTEGER NOT NULL CHECK (request_limit >= 0),
  requests_used  INTEGER NOT NULL DEFAULT 0 CHECK (requests_used >= 0),
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_logs (
  id           BIGSERIAL PRIMARY KEY,
  key_id       UUID NOT NULL REFERENCES api_keys (id) ON DELETE CASCADE,
  model        TEXT NOT NULL,
  provider     TEXT NOT NULL,      
  tokens_in    INTEGER NOT NULL DEFAULT 0,
  tokens_out   INTEGER NOT NULL DEFAULT 0,
  cost_micros  BIGINT NOT NULL DEFAULT 0, 
  status       TEXT NOT NULL,       
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_key_time
  ON usage_logs (key_id, created_at);
