import { config } from '../config';
import { logger } from '../logger';
import { badRequest, badGateway } from '../errors';
import { resolveProvider, supportedModels } from './registry';
import type { ChatRequest, ProviderResult } from './types';

export interface ChatOutcome extends ProviderResult {
  attempts: number;
}

/** Runs a provider call under a hard timeout using AbortController. */
async function withTimeout(
  fn: (signal: AbortSignal) => Promise<ProviderResult>,
  timeoutMs: number,
): Promise<ProviderResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export async function runChat(req: ChatRequest): Promise<ChatOutcome> {
  const primary = resolveProvider(req.model);
  if (!primary) {
    throw badRequest(
      `Unsupported model "${req.model}". Supported models: ${supportedModels().join(', ')}`,
    );
  }

  let attempts = 0;
  let lastErr: unknown;

  for (let i = 0; i < config.PROVIDER_MAX_ATTEMPTS; i++) {
    attempts++;
    try {
      const result = await withTimeout(
        (signal) => primary.chat(req, signal),
        config.PROVIDER_TIMEOUT_MS,
      );
      return { ...result, attempts };
    } catch (err) {
      lastErr = err;
      logger.warn(
        { err, provider: primary.name, attempt: attempts, model: req.model },
        'Provider call failed',
      );
    }
  }

  logger.error(
    { err: lastErr, model: req.model, attempts },
    'Provider exhausted attempts; failing fast',
  );
  throw badGateway(
    `Upstream provider failed for model "${req.model}" after ${attempts} attempt(s)`,
  );
}
