import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../errors';
import { logger } from '../logger';
import { isProd } from '../config';

/** 404 handler for unmatched routes. */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'not_found', message: 'Route not found' },
  });
}


export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    if (err.statusCode >= 500) {
      logger.error({ err }, 'Request failed with server error');
    } else {
      logger.warn({ code: err.code, msg: err.message }, 'Request rejected');
    }
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'internal_error',
      message: isProd ? 'Internal server error' : String(err),
    },
  });
}
