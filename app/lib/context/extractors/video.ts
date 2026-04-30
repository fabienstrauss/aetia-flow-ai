import { extractMediaContextWithGemini } from '../../providers/gemini-context';
import type { ContextSource } from '../types';

export async function extractVideoContext(input: {
  source: ContextSource;
  fingerprint: string;
}) {
  if (!('asset' in input.source)) {
    throw new Error('Video context extraction requires an asset source');
  }

  return extractMediaContextWithGemini({
    workspaceId: input.source.workspaceId,
    sourceNodeId: input.source.sourceNodeId,
    sourceType: 'video',
    sourceFingerprint: input.fingerprint,
    title: input.source.title,
    asset: input.source.asset,
  });
}
