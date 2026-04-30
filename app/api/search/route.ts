import { NextResponse } from 'next/server';

import type { TavilyInput } from '../../lib/canvas/contracts';
import { createMockSearchPayload } from '../../lib/canvas/mock-content';
import { isTavilyConfigured, searchWithTavily } from '../../lib/providers/tavily';

export async function POST(request: Request) {
  const body = (await request.json()) as TavilyInput;

  if (!isTavilyConfigured()) {
    return NextResponse.json(createMockSearchPayload(body));
  }

  try {
    const payload = await searchWithTavily(body);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(createMockSearchPayload(body));
  }
}
