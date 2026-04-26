// ttsService.ts — Server-side TTS generation.
// Priority order: ElevenLabs → Unreal Speech → OpenAI → Play.ht
// First env key that is present wins.

export type TTSProvider = 'elevenlabs' | 'unreal_speech' | 'openai' | 'playht';

/** Returns the audio as a Buffer (mp3) and the provider used. */
export async function generateAudio(
  script: string,
): Promise<{ buffer: Buffer; provider: TTSProvider }> {
  if (process.env.ELEVENLABS_API_KEY) {
    const buffer = await generateWithElevenLabs(script);
    return { buffer, provider: 'elevenlabs' };
  }
  if (process.env.UNREAL_SPEECH_API_KEY) {
    const buffer = await generateWithUnrealSpeech(script);
    return { buffer, provider: 'unreal_speech' };
  }
  if (process.env.OPENAI_API_KEY) {
    const buffer = await generateWithOpenAI(script);
    return { buffer, provider: 'openai' };
  }
  if (process.env.PLAYHT_API_KEY && process.env.PLAYHT_USER_ID) {
    const buffer = await generateWithPlayHT(script);
    return { buffer, provider: 'playht' };
  }
  throw new Error(
    'No TTS API key configured. Add ELEVENLABS_API_KEY, UNREAL_SPEECH_API_KEY, ' +
    'OPENAI_API_KEY, or PLAYHT_API_KEY + PLAYHT_USER_ID to environment variables.',
  );
}

// ── ElevenLabs ────────────────────────────────────────────────────────────────

async function generateWithElevenLabs(script: string): Promise<Buffer> {
  const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Rachel
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        Accept:         'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key':   process.env.ELEVENLABS_API_KEY!,
      },
      body: JSON.stringify({
        text:           script,
        model_id:       'eleven_monolingual_v1',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    },
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => res.status.toString());
    throw new Error(`ElevenLabs error ${res.status}: ${errText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// ── Unreal Speech (best free tier — 250 k chars/month) ────────────────────────
// Hard limit: 3000 chars per request. We split on sentence boundaries and
// concatenate the resulting buffers so long scripts always succeed.

const UNREAL_SPEECH_MAX_CHARS = 2800; // safely under the 3000-char limit

function splitScriptIntoChunks(script: string): string[] {
  // Split on sentence boundaries — never cut mid-sentence
  const sentences = script.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length > UNREAL_SPEECH_MAX_CHARS) {
      if (current.trim()) chunks.push(current.trim());
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function generateUnrealSpeechChunk(text: string): Promise<Buffer> {
  const res = await fetch('https://api.v7.unrealspeech.com/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.UNREAL_SPEECH_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Text:    text,
      VoiceId: process.env.UNREAL_SPEECH_VOICE_ID || 'Scarlett',
      Bitrate: '192k',
      Speed:   '-0.1',
      Pitch:   '1',
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => res.status.toString());
    throw new Error(`Unreal Speech error ${res.status}: ${errText}`);
  }
  const data = await res.json() as { OutputUri: string };
  const audioRes = await fetch(data.OutputUri);
  if (!audioRes.ok) throw new Error(`Unreal Speech fetch error: ${audioRes.status}`);
  return Buffer.from(await audioRes.arrayBuffer());
}

async function generateWithUnrealSpeech(script: string): Promise<Buffer> {
  const chunks = splitScriptIntoChunks(script);
  if (chunks.length === 1) return generateUnrealSpeechChunk(chunks[0]);
  // Multiple chunks — generate sequentially (avoid hammering the API) then concat
  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    buffers.push(await generateUnrealSpeechChunk(chunk));
  }
  return Buffer.concat(buffers);
}

// ── OpenAI TTS ────────────────────────────────────────────────────────────────

async function generateWithOpenAI(script: string): Promise<Buffer> {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: script,
      voice: 'nova',
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => res.status.toString());
    throw new Error(`OpenAI TTS error ${res.status}: ${errText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// ── Play.ht ───────────────────────────────────────────────────────────────────

async function generateWithPlayHT(script: string): Promise<Buffer> {
  const res = await fetch('https://api.play.ht/api/v2/tts', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${process.env.PLAYHT_API_KEY}`,
      'X-USER-ID':    process.env.PLAYHT_USER_ID!,
      'Content-Type': 'application/json',
      Accept:         'audio/mpeg',
    },
    body: JSON.stringify({
      text:          script,
      voice:         'en-US-JennyNeural',
      output_format: 'mp3',
      speed:         0.9,
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => res.status.toString());
    throw new Error(`Play.ht error ${res.status}: ${errText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
