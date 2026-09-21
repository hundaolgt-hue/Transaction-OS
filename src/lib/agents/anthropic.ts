import 'server-only';
import { env } from '../env';

export interface LlmMessage { role: 'user' | 'assistant'; content: string }

export interface LlmResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
}

export class LlmUnavailable extends Error {}

/**
 * Minimal Anthropic Messages API client. The agents degrade to the deterministic
 * rule engine whenever this throws, so the product works without a key.
 */
export async function complete(opts: {
  system: string;
  messages: LlmMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<LlmResult> {
  if (!env.aiEnabled) throw new LlmUnavailable('ANTHROPIC_API_KEY is not configured');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: env.anthropicModel,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.2,
      system: opts.system,
      messages: opts.messages,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new LlmUnavailable(`Anthropic API ${res.status}: ${detail.slice(0, 400)}`);
  }

  const json = (await res.json()) as {
    content: { type: string; text?: string }[];
    usage?: { input_tokens: number; output_tokens: number };
    model: string;
  };

  return {
    text: json.content.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n'),
    tokensIn: json.usage?.input_tokens ?? 0,
    tokensOut: json.usage?.output_tokens ?? 0,
    model: json.model,
  };
}

/** Pull the first JSON object or array out of a model response. */
export function extractJson<T>(text: string): T | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : text;
  const start = candidate.search(/[[{]/);
  if (start < 0) return null;
  for (let end = candidate.length; end > start; end--) {
    const slice = candidate.slice(start, end);
    try {
      return JSON.parse(slice) as T;
    } catch {
      /* keep shrinking */
    }
  }
  return null;
}
