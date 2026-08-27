import { createHash, randomBytes } from 'node:crypto';
import { pool } from '../db/pool';

export interface ApiKeyRow {
  id: string;
  key_hash: string;
  name: string | null;
  request_limit: number;
  requests_used: number;
  active: boolean;
  created_at: Date;
}

const KEY_PREFIX = 'vk_';

/** Deterministic SHA-256 hash of a raw key. We only ever store this. */
export function hashKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

function generateRawKey(): string {
  return KEY_PREFIX + randomBytes(24).toString('hex');
}

export interface CreatedKey {
  id: string;
  rawKey: string;
  name: string | null;
  requestLimit: number;
}

/**
 * Mints a new virtual key. The raw key is returned once for the caller to store;
 * the database keeps only its hash.
 */
export async function createKey(
  name: string | null,
  requestLimit: number,
): Promise<CreatedKey> {
  const rawKey = generateRawKey();
  const keyHash = hashKey(rawKey);

  const { rows } = await pool.query<Pick<ApiKeyRow, 'id'>>(
    `INSERT INTO api_keys (key_hash, name, request_limit)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [keyHash, name, requestLimit],
  );

  return { id: rows[0]!.id, rawKey, name, requestLimit };
}

export async function findActiveKeyByRaw(
  rawKey: string,
): Promise<ApiKeyRow | null> {
  const { rows } = await pool.query<ApiKeyRow>(
    `SELECT * FROM api_keys WHERE key_hash = $1 AND active = TRUE`,
    [hashKey(rawKey)],
  );
  return rows[0] ?? null;
}
