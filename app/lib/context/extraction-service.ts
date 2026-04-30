import type { SupabaseClient } from '@supabase/supabase-js';

import type { ChoiceConfig } from '../campaign/types';
import type { CanvasNode } from '../canvas/types';
import { createContextSourceFingerprint } from './fingerprint';
import { extractContextFromSource } from './extractors';
import { loadCachedContextArtifact, saveContextArtifact } from './persistence';
import { enumerateContextSources } from './source-enumerator';
import type { ExtractedContextArtifact } from './types';

export type WorkspaceExtractionResult = {
  artifacts: ExtractedContextArtifact[];
  reused: number;
  generated: number;
  failed: number;
  errors: Array<{
    sourceNodeId: string;
    sourceType: string;
    message: string;
  }>;
};

export async function extractWorkspaceSources(input: {
  client: SupabaseClient;
  workspaceId: string;
  nodes: CanvasNode[];
  choiceConfig: ChoiceConfig | null;
}) {
  const artifacts: ExtractedContextArtifact[] = [];
  const errors: WorkspaceExtractionResult['errors'] = [];
  let reused = 0;
  let generated = 0;

  const sources = enumerateContextSources({
    workspaceId: input.workspaceId,
    nodes: input.nodes,
    choiceConfig: input.choiceConfig,
  });

  for (const source of sources) {
    const fingerprint = createContextSourceFingerprint(source);

    try {
      const cached = await loadCachedContextArtifact(input.client, {
        workspaceId: input.workspaceId,
        sourceNodeId: source.sourceNodeId,
        sourceFingerprint: fingerprint,
      });

      if (cached) {
        artifacts.push(cached);
        reused += 1;
        continue;
      }

      const extracted = await extractContextFromSource({
        source,
        fingerprint,
      });

      await saveContextArtifact(input.client, extracted);
      artifacts.push(extracted);
      generated += 1;
    } catch (error) {
      errors.push({
        sourceNodeId: source.sourceNodeId,
        sourceType: source.sourceType,
        message: error instanceof Error ? error.message : 'Unknown extraction error',
      });
    }
  }

  return {
    artifacts,
    reused,
    generated,
    failed: errors.length,
    errors,
  };
}
