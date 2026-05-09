import { NextResponse } from 'next/server';

import type { TavilyInput } from '../../lib/canvas/contracts';
import { createMockSearchPayload } from '../../lib/canvas/mock-content';
import { searchWithTavily } from '../../lib/providers/tavily';

export async function POST(request: Request) {
  const body = (await request.json()) as TavilyInput;

  const tavilyKey = request.headers.get('x-tavily-key') ?? process.env.TAVILY_API_KEY ?? null;
  if (!tavilyKey) {
    return NextResponse.json(createMockSearchPayload(body));
  }

  try {
    const payload = await searchWithTavily(body, tavilyKey);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(createMockSearchPayload(body));
  }
}
