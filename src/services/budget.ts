import type { PoolClient } from 'pg';
import { pool } from '../db/pool';

export interface BudgetClaim {
  ok: boolean;
  requestsUsed: number;
  requestLimit: number;
}

/**
 * We claim the slot BEFORE calling the provider (optimistic reservation). If the
 * provider call ultimately fails we refund the slot (see refundClaim), so a
 * failed upstream call does not permanently burn a caller's budget.
 */
export async function claimRequestSlot(keyId: string): Promise<BudgetClaim> {
  const { rows } = await pool.query<{
    requests_used: number;
    request_limit: number;
  }>(
    `UPDATE api_keys
        SET requests_used = requests_used + 1
      WHERE id = $1
        AND active = TRUE
        AND requests_used < request_limit
      RETURNING requests_used, request_limit`,
    [keyId],
  );

  if (rows.length === 0) {
    const { rows: current } = await pool.query<{
      requests_used: number;
      request_limit: number;
    }>(`SELECT requests_used, request_limit FROM api_keys WHERE id = $1`, [
      keyId,
    ]);
    const row = current[0];
    return {
      ok: false,
      requestsUsed: row?.requests_used ?? 0,
      requestLimit: row?.request_limit ?? 0,
    };
  }

  return {
    ok: true,
    requestsUsed: rows[0]!.requests_used,
    requestLimit: rows[0]!.request_limit,
  };
}


export async function refundClaim(
  keyId: string,
  client: PoolClient | typeof pool = pool,
): Promise<void> {
  await client.query(
    `UPDATE api_keys
        SET requests_used = GREATEST(requests_used - 1, 0)
      WHERE id = $1`,
    [keyId],
  );
}
