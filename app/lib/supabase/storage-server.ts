import 'server-only';

import { getSupabaseAdminClient } from './server';
import { CANVAS_ASSETS_BUCKET, GENERATED_CONTENT_BUCKET } from './constants';

async function uploadToBucket(input: {
  bucket: string;
  path: string;
  bytes: Uint8Array;
  mimeType: string;
}): Promise<{ path: string; publicUrl: string }> {
  const client = getSupabaseAdminClient();

  const { error } = await client.storage
    .from(input.bucket)
    .upload(input.path, input.bytes, { contentType: input.mimeType, upsert: true });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = client.storage.from(input.bucket).getPublicUrl(input.path);

  return { path: input.path, publicUrl: data.publicUrl };
}

function mimeTypeToExtension(mimeType: string): string {
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('ogg') || mimeType.includes('opus')) return 'ogg';
  return 'wav';
}

// Canvas-generated assets (used by gemini.ts and hera.ts canvas generation).
// workspaceId organises files per workspace; Phase 2 passes the real UUID.
export async function uploadGeneratedAssetToSupabase(input: {
  bytes: Uint8Array;
  mimeType: string;
  extension: string;
  prefix: string;
  workspaceId?: string;
}): Promise<{ path: string; publicUrl: string }> {
  const folder = input.workspaceId ?? 'shared';
  const path = `${folder}/${input.prefix}-${Date.now()}.${input.extension}`;
  return uploadToBucket({ bucket: CANVAS_ASSETS_BUCKET, path, bytes: input.bytes, mimeType: input.mimeType });
}

// Campaign-generated images and videos.
export async function uploadGeneratedContent(input: {
  bytes: Uint8Array;
  mimeType: string;
  extension: string;
  prefix: string;
}): Promise<{ path: string; publicUrl: string }> {
  const path = `${input.prefix}-${Date.now()}.${input.extension}`;
  return uploadToBucket({ bucket: GENERATED_CONTENT_BUCKET, path, bytes: input.bytes, mimeType: input.mimeType });
}

// Voiceover audio files attached to generated content.
export async function uploadVoiceoverContent(input: {
  bytes: Uint8Array;
  mimeType: string;
  prefix: string;
}): Promise<{ path: string; publicUrl: string }> {
  const extension = mimeTypeToExtension(input.mimeType);
  const path = `${input.prefix}-voiceover-${Date.now()}.${extension}`;
  return uploadToBucket({ bucket: GENERATED_CONTENT_BUCKET, path, bytes: input.bytes, mimeType: input.mimeType });
}
