import type { SupabaseClient } from '@supabase/supabase-js';

import type { ChoiceConfig } from '../campaign/types';
import { createDeterministicHash } from './fingerprint';
import { mergeContextArtifacts } from './merge-context';
import {
  loadCachedWorkspaceContextPack,
  saveWorkspaceContextPack,
} from './persistence';
import type { ExtractedContextArtifact } from './types';

export async function buildWorkspaceContextPack(input: {
  client: SupabaseClient;
  workspaceId: string;
  artifacts: ExtractedContextArtifact[];
  choiceConfig: ChoiceConfig | null;
}) {
  const sourceFingerprint = createDeterministicHash({
    artifacts: input.artifacts.map((artifact) => ({
      sourceNodeId: artifact.sourceNodeId,
      sourceFingerprint: artifact.sourceFingerprint,
    })),
    choiceConfig: input.choiceConfig ?? {},
  });

  const cached = await loadCachedWorkspaceContextPack(
    input.client,
    input.workspaceId,
    sourceFingerprint,
  );

  if (cached) {
    return {
      contextPack: cached,
      sourceFingerprint,
      reused: true,
    };
  }

  const contextPack = mergeContextArtifacts({
    workspaceId: input.workspaceId,
    sourceFingerprint,
    artifacts: input.artifacts,
  });

  await saveWorkspaceContextPack(input.client, {
    workspaceId: input.workspaceId,
    sourceFingerprint,
    context: contextPack,
  });

  return {
    contextPack,
    sourceFingerprint,
    reused: false,
  };
}
