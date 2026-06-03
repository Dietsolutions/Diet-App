/**
 * llmClient.ts — unified LLM client for Anthropic + OpenRouter.
 *
 * Provider selection (in order):
 *   1. OPENROUTER_API_KEY  → use OpenAI-compatible API at openrouter.ai
 *   2. ANTHROPIC_API_KEY   → use Anthropic SDK directly
 *   3. (error)             → throw with setup instructions
 *
 * The model name comes from CLAUDE_MODEL (env var), so the same var works
 * for both providers. Just set the model to whatever your provider supports:
 *   - OpenRouter:  "openai/gpt-4o-mini", "anthropic/claude-sonnet-4", etc.
 *   - Anthropic:   "claude-sonnet-4-20250514", "claude-3-5-sonnet-...", etc.
 *
 * Return type is a plain string (the model's text output) so call sites
 * don't have to know which provider answered.
 *
 * Why a wrapper:
 *   The original code had 6 separate `anthropic.messages.create` call sites
 *   across routes/ai.ts, routes/plan.ts, routes/meals.ts, utils/shoppingListUtils.ts,
 *   and services/aiFoodService.ts. Each one instantiated its own Anthropic client
 *   and parsed `response.content[0].text`. With OpenRouter (or any future
 *   provider), the response shape is different — `choices[0].message.content`.
 *   This wrapper absorbs that difference in one place.
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

const DEFAULT_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

export interface CallLLMOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  // Some Anthropic calls pass a system prompt separately. OpenRouter expects
  // system as a message with role='system'. We handle that translation.
  system?: string;
}

interface LLMProvider {
  kind: 'openrouter' | 'anthropic';
  model: string;
}

function selectProvider(): LLMProvider {
  const model = DEFAULT_MODEL;

  if (process.env.OPENROUTER_API_KEY) {
    return { kind: 'openrouter', model };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { kind: 'anthropic', model };
  }
  throw new Error(
    'No LLM provider configured. Set OPENROUTER_API_KEY or ANTHROPIC_API_KEY in server/.env',
  );
}

let _openai: OpenAI | null = null;
let _anthropic: Anthropic | null = null;

function openaiClient(): OpenAI {
  if (_openai) return _openai;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');
  _openai = new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      // OpenRouter recommends identifying the app in their analytics.
      'HTTP-Referer': process.env.OPENROUTER_APP_URL || 'http://localhost:5173',
      'X-Title': 'Diet Plan & Tracker',
    },
  });
  return _openai;
}

function anthropicClient(): Anthropic {
  if (_anthropic) return _anthropic;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
  _anthropic = new Anthropic({ apiKey });
  return _anthropic;
}

/**
 * Call the configured LLM with a user prompt and optional system prompt.
 * Returns the model's text output as a string.
 *
 * @throws if no provider is configured or the API returns an error.
 */
export async function callLLM(
  userPrompt: string,
  options: CallLLMOptions = {},
): Promise<string> {
  const provider = selectProvider();
  const model = options.model || provider.model;
  const maxTokens = options.maxTokens ?? 4096;

  if (provider.kind === 'openrouter') {
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
    if (options.system) messages.push({ role: 'system', content: options.system });
    messages.push({ role: 'user', content: userPrompt });

    const completion = await openaiClient().chat.completions.create({
      model,
      max_tokens: maxTokens,
      temperature: options.temperature ?? 0.7,
      messages,
    });
    const text = completion.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('OpenRouter returned an empty response');
    }
    return text;
  }

  // Anthropic
  const message = await anthropicClient().messages.create({
    model,
    max_tokens: maxTokens,
    ...(options.system ? { system: options.system } : {}),
    messages: [{ role: 'user', content: userPrompt }],
  });
  const textContent = message.content.find(c => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('Anthropic returned no text content');
  }
  return textContent.text;
}

/**
 * Variant that returns parsed JSON. Strips markdown code fences if present.
 * Use this in call sites that expect the model to return a JSON object/array.
 */
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
  // ```json\n...\n```  or  ```\n...\n```
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) return fenceMatch[1].trim();
  return trimmed;
}

export function getConfiguredModel(): string {
  return DEFAULT_MODEL;
}
