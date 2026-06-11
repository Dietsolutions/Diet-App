# Migration Plan: OpenRouter/OpenAI/Gemini → Claude API

## Files to change

### 1. `server/src/services/llmClient.ts` — Core LLM client
- Remove `openai` import, keep `Anthropic` only
- Remove `openrouter` provider kind and `selectProvider()` OpenRouter branch
- Remove `openaiClient()` and the `OpenAI` singleton
- Simplify `callLLM()` to only use Anthropic SDK
- `callLLMJson()` / `stripCodeFences()` stay unchanged
- Update doc comments

### 2. `server/src/routes/ai.ts` — AI meal plan generation
- Line 58: `OPENROUTER_API_KEY || ANTHROPIC_API_KEY` → `ANTHROPIC_API_KEY`
- Line 60: Update error message
- Line 618: Update auth error message

### 3. `server/src/routes/meals.ts` — Cooking instructions
- Line 448: `ANTHROPIC_API_KEY || OPENROUTER_API_KEY` → `ANTHROPIC_API_KEY`

### 4. `server/src/routes/food.ts` — Food search
- Line 291: `!OPENROUTER_API_KEY && !ANTHROPIC_API_KEY` → `!ANTHROPIC_API_KEY`

### 5. `server/src/services/ttsService.ts` — TTS (DISCUSSION)
- OpenRouter not used here, but OpenAI TTS is one of 4 TTS providers
- Claude has no TTS API — options:
  a) Remove OpenAI TTS option (keep ElevenLabs, Unreal Speech, Play.ht)
  b) Keep it as a separate optional TTS provider
- **Decision needed** before proceeding

### 6. `server/.env.example` — Environment variables
- Remove `OPENROUTER_API_KEY`
- Remove `OPENAI_API_KEY` and `OPENAI_MODEL`
- Uncomment `ANTHROPIC_API_KEY` as default
- Update `CLAUDE_MODEL` default to `claude-sonnet-4-20250514`

### 7. `server/src/app.ts` — Startup env check
- Remove `OPENROUTER_API_KEY` from `OPTIONAL_ENV` array (line 26)

### 8. `server/package.json` — Dependencies
- Remove `"openai"` dependency (only used for OpenRouter in llmClient.ts)
- Keep `"@anthropic-ai/sdk"`

## Verification
1. `cd server && npm run build` — TypeScript compiles clean
2. `cd server && npm test` — All tests pass
3. `cd client && npm run build` — Client builds
4. Provide new `ANTHROPIC_API_KEY` env var
5. Test meal plan generation, food search, cooking instructions endpoints
6. Run Android + iOS dev builds

## Env vars you'll need to set
After migration, the only AI env var needed is:
```
ANTHROPIC_API_KEY="sk-ant-your-key-here"
CLAUDE_MODEL="claude-sonnet-4-20250514"
```

Open the PR with your Claude API key ready — I'll tell you exactly when to set it.
