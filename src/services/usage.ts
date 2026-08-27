import { pool } from '../db/pool';

export interface UsageRecord {
  keyId: string;
  model: string;
  provider: string;
  tokensIn: number;
  tokensOut: number;
  costMicros: number;
  status: 'ok' | 'fallback' | 'error';
}

export async function insertUsage(record: UsageRecord): Promise<void> {
  await pool.query(
    `INSERT INTO usage_logs
       (key_id, model, provider, tokens_in, tokens_out, cost_micros, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      record.keyId,
      record.model,
      record.provider,
      record.tokensIn,
      record.tokensOut,
      record.costMicros,
      record.status,
    ],
  );
}

export interface SpendSummary {
  keyId: string;
  name: string | null;
  requestsUsed: number;
  requestLimit: number;
  totalRequests: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostMicros: number;
}

/**
 * Answers "how much has key X used?" by aggregating the log and
 * joining the key's current counters.
 */
export async function getSpendByKeyId(
  keyId: string,
): Promise<SpendSummary | null> {
  const { rows } = await pool.query<{
    id: string;
    name: string | null;
    requests_used: number;
    request_limit: number;
    total_requests: string;
    total_tokens_in: string | null;
    total_tokens_out: string | null;
    total_cost_micros: string | null;
  }>(
    `SELECT k.id,
            k.name,
            k.requests_used,
            k.request_limit,
            COUNT(u.id)                    AS total_requests,
            COALESCE(SUM(u.tokens_in), 0)  AS total_tokens_in,
            COALESCE(SUM(u.tokens_out), 0) AS total_tokens_out,
            COALESCE(SUM(u.cost_micros), 0) AS total_cost_micros
       FROM api_keys k
       LEFT JOIN usage_logs u ON u.key_id = k.id
      WHERE k.id = $1
      GROUP BY k.id`,
    [keyId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    keyId: row.id,
    name: row.name,
    requestsUsed: row.requests_used,
    requestLimit: row.request_limit,
    totalRequests: Number(row.total_requests),
    totalTokensIn: Number(row.total_tokens_in ?? 0),
    totalTokensOut: Number(row.total_tokens_out ?? 0),
    totalCostMicros: Number(row.total_cost_micros ?? 0),
  };
}
