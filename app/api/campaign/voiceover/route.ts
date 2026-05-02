import { NextResponse } from 'next/server';

import type { GeneratedContentRecord } from '../../../lib/campaign/types';
import {
  GENERATED_CONTENT_BUCKET,
  GENERATED_CONTENT_TABLE,
} from '../../../lib/supabase/constants';
import { getSupabaseServerClient } from '../../../lib/supabase/server';
import { uploadVoiceoverContent } from '../../../lib/supabase/storage-server';
import { generateGradiumVoiceover, isGradiumConfigured } from '../../../lib/providers/gradium';

export const maxDuration = 300;

type GenerateVoiceoverRequest = {
  generatedContentId: string;
  text: string;
  voiceId?: string;
};

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
    const supabase = await getSupabaseServerClient();

    const { data: record, error: loadError } = await supabase
      .from(GENERATED_CONTENT_TABLE)
      .select('*')
      .eq('id', body.generatedContentId)
      .single<GeneratedContentRecord>();

    if (loadError || !record) {
      return NextResponse.json({ error: 'Generated content not found' }, { status: 404 });
    }

    if (record.content_type !== 'video' && !record.mime_type.startsWith('video/')) {
      return NextResponse.json(
        { error: 'Voiceover is only supported for video content' },
        { status: 400 },
      );
    }

    const voiceover = await generateGradiumVoiceover({
      text: body.text,
      voiceId: body.voiceId,
    });

    const uploaded = await uploadVoiceoverContent({
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
      try {
        await supabase.storage.from(GENERATED_CONTENT_BUCKET).remove([uploaded.path]);
      } catch {
        // noop — orphaned file is better than a broken response
      }
      throw new Error(updateError?.message ?? 'Failed to save voiceover metadata');
    }

    if (record.voiceover_storage_path && record.voiceover_storage_path !== uploaded.path) {
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
