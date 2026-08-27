import { config } from '../config';
import { badGateway } from '../errors';
import type { ChatRequest, Provider, ProviderResult } from './types';

interface OpenAIResponse {
  model: string;
  choices: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

export const openaiProvider: Provider = {
  name: 'openai',

  async chat(req: ChatRequest, signal: AbortSignal): Promise<ProviderResult> {
    const res = await fetch(`${config.OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        temperature: req.temperature,
        max_tokens: req.max_tokens,
      }),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw badGateway(
        `OpenAI returned ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
      );
    }

    const data = (await res.json()) as OpenAIResponse;
    const content = data.choices?.[0]?.message?.content ?? '';

    return {
      provider: 'openai',
      model: req.model,
      content,
      usage: {
        tokensIn: data.usage?.prompt_tokens ?? 0,
        tokensOut: data.usage?.completion_tokens ?? 0,
      },
      raw: data,
    };
  },
};
