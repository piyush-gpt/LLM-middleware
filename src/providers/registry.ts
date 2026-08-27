import { openaiProvider } from './openai';
import type { Provider } from './types';

const MODEL_PROVIDERS: Record<string, Provider> = {
  'openai/gpt-4o': openaiProvider,
  'openai/gpt-4o-mini': openaiProvider,
  'openai/gpt-4.1-mini': openaiProvider,
  'openai/gpt-3.5-turbo': openaiProvider,
};

export function resolveProvider(model: string): Provider | null {
  return MODEL_PROVIDERS[model] ?? null;
}

export function supportedModels(): string[] {
  return Object.keys(MODEL_PROVIDERS);
}
