import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

// OpenRouter uses Anthropic's SDK but with a different base URL and key.
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

export interface CallLLMOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  system?: string;
  timeout?: number;
  /**
   * Fired once, the moment the provider accepts the request and starts billing
   * — i.e. when the first stream event (`message_start`) arrives. Anything that
   * throws before this point cost nothing: a bad key, a malformed request, the
   * SDK's own client-side guards. Callers that meter usage use this to tell a
   * genuinely-charged attempt from a free one.
   */
  onCostIncurred?: () => void;
}

let _client: Anthropic | null = null;

function llmClient(): Anthropic {
  if (_client) return _client;

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const anthropicKey  = process.env.ANTHROPIC_API_KEY;

  if (openrouterKey) {
    _client = new Anthropic({
      apiKey:  openrouterKey,
      baseURL: OPENROUTER_BASE,
      defaultHeaders: {
        'HTTP-Referer': process.env.FRONTEND_URL || 'https://getplanyourplate.com',
        'X-Title': 'Diet Plan & Tracker',
      },
    });
  } else if (anthropicKey) {
    _client = new Anthropic({ apiKey: anthropicKey });
  } else {
    throw new Error('No LLM API key configured. Set ANTHROPIC_API_KEY or OPENROUTER_API_KEY.');
  }

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

  // Streamed, not messages.create(). The SDK refuses a non-streaming request
  // whose max_tokens implies it could run past its 10-minute ceiling — the
  // estimate is (60min * max_tokens) / 128000, so anything over ~21,300 tokens
  // throws "Streaming is required for operations that may take longer than 10
  // minutes" before a request is even sent. The 14-day plan asks for 32,000 and
  // was failing there every time. We still only want the finished text, so the
  // stream is collapsed with finalMessage(); AbortSignal keeps the real bound.
  const stream = llmClient().messages.stream(
    {
      model,
      max_tokens: maxTokens,
      ...(options.system ? { system: options.system } : {}),
      messages: [{ role: 'user', content: userPrompt }],
    },
    { signal },
  );

  if (options.onCostIncurred) {
    const notify = options.onCostIncurred;
    let fired = false;
    stream.on('streamEvent', () => {
      if (fired) return;   // first event only — message_start
      fired = true;
      notify();
    });
  }

  const message = await stream.finalMessage();

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
