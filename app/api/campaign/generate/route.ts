import { NextResponse } from 'next/server';

import type { GeneratedContentRecord, ContentTypeId, AspectRatioId } from '../../../lib/campaign/types';
import type { WorkspaceContextPack } from '../../../lib/context/workspace-context';
import { buildMasterPrompt } from '../../../lib/campaign/prompt-builder';
import { generateAndStoreCampaignContent, deleteGeneratedContent } from '../../../lib/campaign/generate';
import { isGeminiConfigured } from '../../../lib/providers/gemini';

export const maxDuration = 300;

export type GenerateCampaignRequest = {
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

export async function POST(request: Request) {
  if (!isGeminiConfigured()) {
    return NextResponse.json({ error: 'Gemini API not configured' }, { status: 503 });
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
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[campaign/generate] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
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
