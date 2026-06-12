import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import type { GeneratedContentRecord, ContentTypeId, AspectRatioId } from '../../../lib/campaign/types';
import type { WorkspaceContextPack } from '../../../lib/context/workspace-context';
import { buildMasterPrompt } from '../../../lib/campaign/prompt-builder';
import { generateAndStoreCampaignContent, deleteGeneratedContent } from '../../../lib/campaign/generate';

export const maxDuration = 300;

export type GenerateCampaignRequest = {
  workspaceId: string;
  platform: string;
  contentType: ContentTypeId;
  audience: string;
  aspectRatio: AspectRatioId;
  templateId?: string;
  contextPack: WorkspaceContextPack;
  refinePrompt?: string;
  referenceAsset?: GeneratedContentRecord;
  existingId?: string;
};

export type DeleteCampaignRequest = {
  id: string;
  storagePath: string;
};

async function getUserFromRequest(request: NextRequest): Promise<string | null> {
  const cookieNames = request.cookies.getAll().map(c => c.name);
  console.log('[auth] cookies present:', cookieNames);
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    },
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  console.log('[auth] user:', user?.id ?? 'null', 'error:', error?.message ?? 'none');
  return user?.id ?? null;
}

export async function POST(request: NextRequest) {
  const geminiKey = request.headers.get('x-gemini-key') ?? process.env.GEMINI_API_KEY ?? null;
  if (!geminiKey) {
    return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 503 });
  }

  const userId = await getUserFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: GenerateCampaignRequest;
  try {
    body = (await request.json()) as GenerateCampaignRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const basePrompt = buildMasterPrompt({
      platform: body.platform,
      contentType: body.contentType,
      audience: body.audience,
      aspectRatio: body.aspectRatio,
      templateId: body.templateId,
      contextPack: body.contextPack,
    });

    const prompt = body.refinePrompt
      ? `REFINE the following content based on this instruction: "${body.refinePrompt}"\n\nOriginal Concept Guidelines:\n${basePrompt}`
      : basePrompt;

    const result = await generateAndStoreCampaignContent({
      userId,
      workspaceId: body.workspaceId,
      platform: body.platform,
      contentType: body.contentType,
      audience: body.audience,
      aspectRatio: body.aspectRatio,
      templateId: body.templateId,
      prompt,
      contextPack: body.contextPack,
      primaryReferenceUrl: body.contextPack?.productReferenceUrl,
      refineReferenceUrl: body.referenceAsset?.public_url,
      existingId: body.existingId,
      existingStoragePath: body.referenceAsset?.storage_path,
      apiKey: geminiKey,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[campaign/generate] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  let body: DeleteCampaignRequest;
  try {
    body = (await request.json()) as DeleteCampaignRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    await deleteGeneratedContent(body.id, body.storagePath);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Delete failed' },
      { status: 500 },
    );
  }
}
