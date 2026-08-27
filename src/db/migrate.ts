import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pool, closePool } from './pool';
import { logger } from '../logger';

export async function migrate(): Promise<void> {
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  logger.info('Database schema applied');
}

