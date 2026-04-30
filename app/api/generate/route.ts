import { NextResponse } from 'next/server';

import type { GenerateInput } from '../../lib/canvas/contracts';
import { createMockGenerationPayload } from '../../lib/canvas/mock-content';
import {
  generateCanvasPayloadWithGemini,
  isGeminiConfigured,
} from '../../lib/providers/gemini';
import { generateHeraAnimationPayload, isHeraConfigured } from '../../lib/providers/hera';

export const maxDuration = 300;

export async function POST(request: Request) {
  const body = (await request.json()) as GenerateInput;

  if (body.type === 'animation') {
    if (!isHeraConfigured()) {
      return NextResponse.json(createMockGenerationPayload(body));
    }
    try {
      const payload = await generateHeraAnimationPayload(body.prompt);
      return NextResponse.json(payload);
    } catch (error) {
      console.error('[hera] generation error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Hera generation failed' },
        { status: 500 },
      );
    }
  }

  if (!isGeminiConfigured()) {
    return NextResponse.json(createMockGenerationPayload(body));
  }

  try {
    const payload = await generateCanvasPayloadWithGemini(body);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(createMockGenerationPayload(body));
  }
}
