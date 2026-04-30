import { NextResponse } from 'next/server';

import type { GeneratedContentRecord } from '../../../lib/campaign/types';
import {
  GENERATED_CONTENT_BUCKET,
  GENERATED_CONTENT_TABLE,
} from '../../../lib/supabase/constants';
import { getSupabaseServerClient, getSupabaseStoragePublicUrl } from '../../../lib/supabase/server';
import { generateGradiumVoiceover, isGradiumConfigured } from '../../../lib/providers/gradium';

export const maxDuration = 300;

type GenerateVoiceoverRequest = {
  generatedContentId: string;
  text: string;
  voiceId?: string;
};

function extensionForMimeType(mimeType: string) {
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('ogg') || mimeType.includes('opus')) return 'ogg';
  return 'wav';
}

async function uploadVoiceover(input: {
  bytes: Uint8Array;
  mimeType: string;
  prefix: string;
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Missing Supabase env');
  }

  const extension = extensionForMimeType(input.mimeType);
  const path = `${input.prefix}-voiceover-${Date.now()}.${extension}`;
  const uploadUrl = `${url}/storage/v1/object/${GENERATED_CONTENT_BUCKET}/${path}`;

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
      'Content-Type': input.mimeType,
      'x-upsert': 'true',
    },
    body: Buffer.from(input.bytes),
  });

  if (!uploadRes.ok) {
    throw new Error(`Voiceover upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
  }

  return {
    path,
    publicUrl: getSupabaseStoragePublicUrl(GENERATED_CONTENT_BUCKET, path),
  };
}

export async function POST(request: Request) {
  if (!isGradiumConfigured()) {
    return NextResponse.json({ error: 'Gradium API not configured' }, { status: 503 });
  }

  let body: GenerateVoiceoverRequest;
  try {
    body = (await request.json()) as GenerateVoiceoverRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.generatedContentId?.trim()) {
    return NextResponse.json({ error: 'generatedContentId is required' }, { status: 400 });
  }

  if (!body.text?.trim()) {
    return NextResponse.json({ error: 'Voiceover text is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();

    const { data: record, error: loadError } = await supabase
      .from(GENERATED_CONTENT_TABLE)
      .select('*')
      .eq('id', body.generatedContentId)
      .single<GeneratedContentRecord>();

    if (loadError || !record) {
      return NextResponse.json({ error: 'Generated content not found' }, { status: 404 });
    }

    if (record.content_type !== 'video' && !record.mime_type.startsWith('video/')) {
      return NextResponse.json({ error: 'Voiceover is only supported for video content' }, { status: 400 });
    }

    const voiceover = await generateGradiumVoiceover({
      text: body.text,
      voiceId: body.voiceId,
    });

    const uploaded = await uploadVoiceover({
      bytes: voiceover.bytes,
      mimeType: voiceover.mimeType,
      prefix: `${record.platform}-${record.content_type}`,
    });

    const { data: updatedRecord, error: updateError } = await supabase
      .from(GENERATED_CONTENT_TABLE)
      .update({
        voiceover_storage_path: uploaded.path,
        voiceover_public_url: uploaded.publicUrl,
        voiceover_mime_type: voiceover.mimeType,
        voiceover_text: body.text.trim(),
        voiceover_voice_id: voiceover.voiceId,
      })
      .eq('id', record.id)
      .select()
      .single<GeneratedContentRecord>();

    if (updateError || !updatedRecord) {
      // Avoid orphaning uploaded files when DB update fails.
      try {
        await supabase.storage.from(GENERATED_CONTENT_BUCKET).remove([uploaded.path]);
      } catch {
        // noop
      }
      throw new Error(updateError?.message ?? 'Failed to save voiceover metadata');
    }

    if (
      record.voiceover_storage_path &&
      record.voiceover_storage_path !== uploaded.path
    ) {
      try {
        await supabase.storage
          .from(GENERATED_CONTENT_BUCKET)
          .remove([record.voiceover_storage_path]);
      } catch {
        // Keep request successful even if old file cleanup fails.
      }
    }

    return NextResponse.json(updatedRecord);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Voiceover generation failed';
    console.error('[campaign/voiceover] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
