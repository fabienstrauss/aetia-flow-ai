import type { ContextSource, ExtractedContextArtifact } from '../types';
import { extractChoiceConfigContext } from './choice-config';
import { extractDocumentContext } from './document';
import { extractImageContext } from './image';
import { extractTextContext } from './text';
import { extractVideoContext } from './video';

export async function extractContextFromSource(input: {
  source: ContextSource;
  fingerprint: string;
}): Promise<ExtractedContextArtifact> {
  if (input.source.sourceType === 'choice-config') {
    return extractChoiceConfigContext({
      source: input.source,
      fingerprint: input.fingerprint,
    });
  }

  if (
    input.source.sourceType === 'note' ||
    input.source.sourceType === 'research' ||
    input.source.sourceType === 'template' ||
    input.source.sourceType === 'generated'
  ) {
    return extractTextContext({
      source: input.source,
      fingerprint: input.fingerprint,
    });
  }

  if (input.source.sourceType === 'image') {
    return extractImageContext({
      source: input.source,
      fingerprint: input.fingerprint,
    });
  }

  if (input.source.sourceType === 'video') {
    return extractVideoContext({
      source: input.source,
      fingerprint: input.fingerprint,
    });
  }

  return extractDocumentContext({
    source: input.source,
    fingerprint: input.fingerprint,
  });
}
