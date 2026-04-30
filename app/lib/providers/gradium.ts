import 'server-only';

const GRADIUM_API_BASE = 'https://api.gradium.ai/api';
const GRADIUM_TTS_PATH = '/post/speech/tts';
const DEFAULT_VOICE_ID = 'YTpq7expH9539ERJ';
const DEFAULT_OUTPUT_FORMAT = 'wav';

function getGradiumApiKey() {
  const apiKey = process.env.GRADIUM_API_KEY;

  if (!apiKey) {
    throw new Error('Missing GRADIUM_API_KEY');
  }

  return apiKey;
}

export function isGradiumConfigured() {
  return Boolean(process.env.GRADIUM_API_KEY);
}

export async function generateGradiumVoiceover(input: {
  text: string;
  voiceId?: string;
}) {
  const text = input.text.trim();
  if (!text) {
    throw new Error('Voiceover text is required');
  }

  const voiceId = input.voiceId || process.env.GRADIUM_VOICE_ID || DEFAULT_VOICE_ID;

  const response = await fetch(`${GRADIUM_API_BASE}${GRADIUM_TTS_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': getGradiumApiKey(),
    },
    body: JSON.stringify({
      text,
      voice_id: voiceId,
      output_format: DEFAULT_OUTPUT_FORMAT,
      only_audio: true,
    }),
  });

  if (!response.ok) {
    let message = `Gradium TTS request failed: ${response.status}`;

    try {
      const payload = (await response.json()) as { error?: string; message?: string };
      message = payload.error || payload.message || message;
    } catch {
      const body = await response.text();
      if (body) {
        message = `${message} ${body}`;
      }
    }

    throw new Error(message);
  }

  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    mimeType: response.headers.get('content-type') || 'audio/wav',
    voiceId,
  };
}
