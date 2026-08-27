/**
 
 the numbers below are the
 * USD-per-1M-tokens figures directly.
 */
interface ModelPrice {
  inputMicrosPerToken: number;
  outputMicrosPerToken: number;
}

const PRICES: Record<string, ModelPrice> = {
  'openai/gpt-4o-mini': { inputMicrosPerToken: 0.15, outputMicrosPerToken: 0.6 },
  'openai/gpt-4o': { inputMicrosPerToken: 2.5, outputMicrosPerToken: 10 },
  'openai/gpt-4.1-mini': { inputMicrosPerToken: 0.4, outputMicrosPerToken: 1.6 },
  'openai/gpt-3.5-turbo': { inputMicrosPerToken: 0.5, outputMicrosPerToken: 1.5 },
};

const DEFAULT_PRICE: ModelPrice = {
  inputMicrosPerToken: 0.5,
  outputMicrosPerToken: 1.5,
};

export function estimateCostMicros(params: {
  model: string;
  tokensIn: number;
  tokensOut: number;
}): number {
  const price = PRICES[params.model] ?? DEFAULT_PRICE;

  const raw =
    params.tokensIn * price.inputMicrosPerToken +
    params.tokensOut * price.outputMicrosPerToken;

  return Math.ceil(raw);
}

/** Formats micro-USD as a human-readable USD string, e.g. 1500 -> "$0.0015". */
export function formatUsd(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(6)}`;
}
