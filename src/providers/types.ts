export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

export interface TokenUsage {
  tokensIn: number;
  tokensOut: number;
}

/** Normalized result returned by every provider adapter. */
export interface ProviderResult {
  provider: 'openai';
  model: string;
  content: string;
  usage: TokenUsage;
  raw: unknown;
}

export interface Provider {
  readonly name: 'openai';
  chat(req: ChatRequest, signal: AbortSignal): Promise<ProviderResult>;
}
