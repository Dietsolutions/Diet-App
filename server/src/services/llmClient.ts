import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

export interface CallLLMOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  system?: string;
  timeout?: number;
}

let _client: Anthropic | null = null;

function llmClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('No LLM API key configured. Set ANTHROPIC_API_KEY in server/.env');
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

export async function callLLM(
  userPrompt: string,
  options: CallLLMOptions = {},
): Promise<string> {
  const model = options.model || DEFAULT_MODEL;
  const maxTokens = options.maxTokens ?? 4096;
  const timeout = options.timeout ?? 30_000;
  const signal = AbortSignal.timeout(timeout);

  const message = await llmClient().messages.create(
    {
      model,
      max_tokens: maxTokens,
      ...(options.system ? { system: options.system } : {}),
      messages: [{ role: 'user', content: userPrompt }],
    },
    { signal },
  );

  const textContent = message.content.find(c => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('Claude returned no text content');
  }
  return textContent.text;
}

export async function callLLMJson<T = unknown>(
  userPrompt: string,
  options: CallLLMOptions = {},
): Promise<T> {
  const text = await callLLM(userPrompt, options);
  const cleaned = stripCodeFences(text);
  return JSON.parse(cleaned) as T;
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) return fenceMatch[1].trim();
  return trimmed;
}

export function getConfiguredModel(): string {
  return DEFAULT_MODEL;
}
