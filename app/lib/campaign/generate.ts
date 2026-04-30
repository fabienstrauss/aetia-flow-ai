import 'server-only';

import { getSupabaseServerClient, getSupabaseStoragePublicUrl } from '../supabase/server';
import {
  GENERATED_CONTENT_BUCKET,
  GENERATED_CONTENT_TABLE,
  WORKSPACE_ID,
} from '../supabase/constants';
import type { ContentTypeId, AspectRatioId, GeneratedContentRecord } from './types';
import type { WorkspaceContextPack } from '../context/workspace-context';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_IMAGE_MODEL = 'gemini-3-pro-image-preview';
const GEMINI_VEO_MODEL = 'veo-3.1-fast-generate-preview'; //veo-3.1-generate-preview

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Missing GEMINI_API_KEY');
  return key;
}

function toApiAspectRatio(ar: AspectRatioId): string {
  const map: Record<AspectRatioId, string> = {
    vertical: '9:16',
    square: '1:1',
    horizontal: '16:9',
  };
  return map[ar];
}

async function uploadToGeneratedBucket(input: {
  bytes: Uint8Array;
  mimeType: string;
  extension: string;
  prefix: string;
}): Promise<{ path: string; publicUrl: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Missing Supabase env');

  const path = `${input.prefix}-${Date.now()}.${input.extension}`;
  const uploadUrl = `${url}/storage/v1/object/${GENERATED_CONTENT_BUCKET}/${path}`;

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
      'Content-Type': input.mimeType,
      'x-upsert': 'true',
    },
    body: Buffer.from(input.bytes),
  });

  if (!response.ok) {
    throw new Error(`Storage upload failed: ${response.status} ${await response.text()}`);
  }

  return {
    path,
    publicUrl: getSupabaseStoragePublicUrl(GENERATED_CONTENT_BUCKET, path),
  };
}

async function generateImageBytes(
  prompt: string,
  aspectRatio: AspectRatioId,
  referenceImageUrl?: string,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const apiKey = getApiKey();

  const parts: any[] = [{ text: prompt }];

  if (referenceImageUrl) {
    try {
      console.log(`[generate] Fetching reference image: ${referenceImageUrl}`);
      const imgRes = await fetch(referenceImageUrl);
      if (imgRes.ok) {
        const imgBuffer = await imgRes.arrayBuffer();
        parts.push({
          inlineData: {
            mimeType: imgRes.headers.get('content-type') || 'image/png',
            data: Buffer.from(imgBuffer).toString('base64'),
          },
        });
        console.log(`[generate] Reference image attached`);
      }
    } catch (e) {
      console.warn(`[generate] Failed to fetch reference image, proceeding with text-only:`, e);
    }
  }

  console.log(`[generate] → Gemini image request (${GEMINI_IMAGE_MODEL}, ${toApiAspectRatio(aspectRatio)})`);
  const response = await fetch(`${GEMINI_API_BASE}/models/${GEMINI_IMAGE_MODEL}:generateContent`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio: toApiAspectRatio(aspectRatio) },
      },
    }),
  });

  console.log(`[generate] ← Gemini image response: ${response.status}`);
  if (!response.ok) {
    const body = await response.text();
    console.error(`[generate] Gemini image error body:`, body);
    throw new Error(`Gemini image request failed: ${response.status} ${body}`);
  }

  const json = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
    }>;
  };

  const imagePart = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    console.error(`[generate] Gemini image: no image data in response`, JSON.stringify(json, null, 2));
    throw new Error('Gemini returned no image data');
  }

  console.log(`[generate] Image received (${imagePart.inlineData.mimeType}), uploading to storage…`);
  return {
    bytes: Uint8Array.from(Buffer.from(imagePart.inlineData.data, 'base64')),
    mimeType: imagePart.inlineData.mimeType ?? 'image/png',
  };
}

async function generateVideoBytes(
  prompt: string,
  aspectRatio: AspectRatioId,
  referenceImageUrl?: string,
): Promise<{ bytes: Uint8Array }> {
  const apiKey = getApiKey();

  type VeoOperation = {
    name?: string;
    done?: boolean;
    response?: {
      generateVideoResponse?: {
        generatedSamples?: Array<{ video?: { uri?: string } }>;
      };
    };
  };

  const instance: any = { prompt };

  if (referenceImageUrl) {
    try {
      console.log(`[generate] Fetching reference image for Veo referenceImages: ${referenceImageUrl}`);
      const imgRes = await fetch(referenceImageUrl);
      if (imgRes.ok) {
        const imgBuffer = await imgRes.arrayBuffer();
        instance.referenceImages = [
          {
            referenceType: 'asset',
            image: {
              bytesBase64Encoded: Buffer.from(imgBuffer).toString('base64'),
              mimeType: imgRes.headers.get('content-type') || 'image/jpeg',
            },
          },
        ];
        console.log(`[generate] Reference image attached as referenceImages (style anchor)`);
      }
    } catch (e) {
      console.warn(`[generate] Failed to fetch reference image for Veo, proceeding without:`, e);
    }
  }

  console.log(`[generate] → Veo video request (${GEMINI_VEO_MODEL}, ${toApiAspectRatio(aspectRatio)})`);
  const startRes = await fetch(`${GEMINI_API_BASE}/models/${GEMINI_VEO_MODEL}:predictLongRunning`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      instances: [instance],
      parameters: { aspectRatio: toApiAspectRatio(aspectRatio) },
    }),
  });

  console.log(`[generate] ← Veo start response: ${startRes.status}`);
  if (!startRes.ok) {
    const body = await startRes.text();
    console.error(`[generate] Veo start error body:`, body);
    throw new Error(`Veo request failed: ${startRes.status} ${body}`);
  }

  const operation = (await startRes.json()) as VeoOperation;
  const operationName = operation.name;
  if (!operationName) throw new Error('Veo returned no operation name');
  console.log(`[generate] Veo operation started: ${operationName}`);

  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise((r) => setTimeout(r, 10_000));
    console.log(`[generate] Veo poll attempt ${attempt + 1}/60…`);

    const pollRes = await fetch(`${GEMINI_API_BASE}/${operationName}`, {
      headers: { 'x-goog-api-key': apiKey },
    });
    if (!pollRes.ok) throw new Error(`Veo poll failed: ${pollRes.status}`);

    const op = (await pollRes.json()) as VeoOperation;
    if (op.done) {
      console.log(`[generate] Veo operation complete`);
      const videoUri = op.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
      if (!videoUri) throw new Error('Veo returned no video URI');

      const dlRes = await fetch(videoUri, { headers: { 'x-goog-api-key': apiKey } });
      if (!dlRes.ok) throw new Error(`Video download failed: ${dlRes.status}`);

      return { bytes: new Uint8Array(await dlRes.arrayBuffer()) };
    }
  }

  throw new Error('Timed out waiting for Veo video generation');
}

export async function generateAndStoreCampaignContent(input: {
  platform: string;
  contentType: ContentTypeId;
  audience: string;
  aspectRatio: AspectRatioId;
  templateId?: string;
  prompt: string;
  contextPack?: WorkspaceContextPack;
  primaryReferenceUrl?: string;
  refineReferenceUrl?: string;
  existingId?: string;
  existingStoragePath?: string;
}): Promise<GeneratedContentRecord> {
  const isVideo = input.contentType === 'video';
  const prefix = `${input.platform}-${input.contentType}`;

  let storagePath: string;
  let publicUrl: string;
  let mimeType: string;

  console.log(`[generate] Starting ${input.contentType} generation for ${input.platform}`);

  if (isVideo) {
    // Pick a reference image for Veo (any image; Veo uses it as a visual anchor)
    let referenceImageUrl: string | undefined;

    // 1. Refine reference (highest priority — the previously generated video frame)
    if (input.refineReferenceUrl) {
      referenceImageUrl = input.refineReferenceUrl;
    }
    // 2. Product reference photo (most useful for brand consistency)
    else if (input.primaryReferenceUrl) {
      referenceImageUrl = input.primaryReferenceUrl;
    }
    // 3. First workspace image from context pack
    else if (input.contextPack?.images?.length) {
      const firstImageNodeId = input.contextPack.images[0].sourceNodeId;
      const artifact = input.contextPack.sourceArtifacts.find(a => a.sourceNodeId === firstImageNodeId);
      const url = (artifact?.rawMetadata?.asset as any)?.previewUrl;
      if (url && url.startsWith('http')) {
        referenceImageUrl = url;
      }
    }

    const { bytes } = await generateVideoBytes(input.prompt, input.aspectRatio, referenceImageUrl);
    console.log(`[generate] Uploading video to storage…`);
    const uploaded = await uploadToGeneratedBucket({
      bytes,
      mimeType: 'video/mp4',
      extension: 'mp4',
      prefix,
    });
    storagePath = uploaded.path;
    publicUrl = uploaded.publicUrl;
    mimeType = 'video/mp4';
  } else {
    // Pick exactly one reference image URL based on priority
    let referenceImageUrl: string | undefined;
    
    // 1. Refine reference (highest priority if refining)
    if (input.refineReferenceUrl) {
      referenceImageUrl = input.refineReferenceUrl;
    } 
    // 2. Primary product reference (high priority)
    else if (input.primaryReferenceUrl) {
      referenceImageUrl = input.primaryReferenceUrl;
    }
    // 3. Workspace context images (secondary priority)
    else if (input.contextPack?.images?.length) {
      const firstImageNodeId = input.contextPack.images[0].sourceNodeId;
      const artifact = input.contextPack.sourceArtifacts.find(a => a.sourceNodeId === firstImageNodeId);
      const url = (artifact?.rawMetadata?.asset as any)?.previewUrl || input.contextPack.images[0].title;
      if (url && url.startsWith('http')) {
        referenceImageUrl = url;
      }
    }

    if (referenceImageUrl) {
      console.log(`[generate] Using reference image: ${referenceImageUrl}`);
    }

    const { bytes, mimeType: imgMime } = await generateImageBytes(input.prompt, input.aspectRatio, referenceImageUrl);
    const ext = imgMime.includes('jpeg') ? 'jpg' : 'png';
    console.log(`[generate] Uploading image to storage…`);
    const uploaded = await uploadToGeneratedBucket({ bytes, mimeType: imgMime, extension: ext, prefix });
    storagePath = uploaded.path;
    publicUrl = uploaded.publicUrl;
    mimeType = imgMime;
  }

  const supabase = getSupabaseServerClient();

  // When refining: clean up old storage file and DB record before inserting fresh
  if (input.existingId) {
    if (input.existingStoragePath) {
      try { await supabase.storage.from(GENERATED_CONTENT_BUCKET).remove([input.existingStoragePath]); } catch {}
    }
    try { await supabase.from(GENERATED_CONTENT_TABLE).delete().eq('id', input.existingId); } catch {}
  }

  console.log(`[generate] Saving record to DB…`);
  const payload = {
    workspace_id: WORKSPACE_ID,
    platform: input.platform,
    content_type: input.contentType,
    prompt: input.prompt,
    storage_path: storagePath,
    public_url: publicUrl,
    mime_type: mimeType,
    template_id: input.templateId ?? null,
    audience: input.audience,
    aspect_ratio: input.aspectRatio,
  };

  const { data, error } = await supabase
    .from(GENERATED_CONTENT_TABLE)
    .insert(payload)
    .select()
    .single<GeneratedContentRecord>();

  if (error) throw new Error(`DB insert failed: ${error.message}`);
  return data;
}

export async function deleteGeneratedContent(id: string, storagePath: string): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { data: existingRecord } = await supabase
    .from(GENERATED_CONTENT_TABLE)
    .select('voiceover_storage_path')
    .eq('id', id)
    .single<{ voiceover_storage_path: string | null }>();

  const pathsToDelete = [storagePath];
  if (existingRecord?.voiceover_storage_path) {
    pathsToDelete.push(existingRecord.voiceover_storage_path);
  }

  const { error: storageError } = await supabase.storage
    .from(GENERATED_CONTENT_BUCKET)
    .remove(pathsToDelete);

  if (storageError) throw storageError;

  const { error: dbError } = await supabase
    .from(GENERATED_CONTENT_TABLE)
    .delete()
    .eq('id', id);

  if (dbError) throw dbError;
}
