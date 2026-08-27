import type { ApiKeyRow } from '../services/keys';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** The authenticated virtual key row, set by the auth middleware. */
      apiKey?: ApiKeyRow;
    }
  }
}

export {};
