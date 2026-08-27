import type { Request, Response, NextFunction } from 'express';
import { unauthorized } from '../errors';
import { findActiveKeyByRaw } from '../services/keys';

function extractRawKey(req: Request): string | null {
  const auth = req.header('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  const apiKeyHeader = req.header('x-api-key');
  return apiKeyHeader?.trim() || null;
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const rawKey = extractRawKey(req);
  if (!rawKey) {
    return next(unauthorized('Provide a gateway key via Authorization: Bearer'));
  }

  const key = await findActiveKeyByRaw(rawKey);
  if (!key) {
    return next(unauthorized('Invalid or inactive API key'));
  }

  req.apiKey = key;
  next();
}
