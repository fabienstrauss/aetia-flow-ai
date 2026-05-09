import { NextResponse } from 'next/server';

import type { GenerateInput } from '../../lib/canvas/contracts';
import { createMockGenerationPayload } from '../../lib/canvas/mock-content';
import { generateCanvasPayloadWithGemini } from '../../lib/providers/gemini';
import { generateHeraAnimationPayload } from '../../lib/providers/hera';

export const maxDuration = 300;

export async function POST(request: Request) {
  const body = (await request.json()) as GenerateInput;

  if (body.type === 'animation') {
    const heraKey = request.headers.get('x-hera-key') ?? process.env.HERA_API_KEY ?? null;
    if (!heraKey) {
      return NextResponse.json(createMockGenerationPayload(body));
    }
    try {
      const payload = await generateHeraAnimationPayload(body.prompt, heraKey);
      return NextResponse.json(payload);
    } catch (error) {
      console.error('[hera] generation error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Hera generation failed' },
        { status: 500 },
      );
    }
  }

  const geminiKey = request.headers.get('x-gemini-key') ?? process.env.GEMINI_API_KEY ?? null;
  if (!geminiKey) {
    return NextResponse.json(createMockGenerationPayload(body));
  }

  try {
    const payload = await generateCanvasPayloadWithGemini(body, geminiKey);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(createMockGenerationPayload(body));
  }
}
