export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, 'bad_request', message, details);

export const unauthorized = (message = 'Missing or invalid credentials') =>
  new HttpError(401, 'unauthorized', message);

export const forbidden = (message = 'Forbidden') =>
  new HttpError(403, 'forbidden', message);

export const paymentRequired = (message: string) =>
  new HttpError(402, 'payment_required', message);

export const tooManyRequests = (message: string) =>
  new HttpError(429, 'budget_exceeded', message);

export const badGateway = (message: string) =>
  new HttpError(502, 'upstream_error', message);
