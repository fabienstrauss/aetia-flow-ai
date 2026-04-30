import type { SupabaseClient } from '@supabase/supabase-js';

import {
  WORKSPACE_CONTEXT_ARTIFACTS_TABLE,
  WORKSPACE_CONTEXT_PACKS_TABLE,
} from '../supabase/constants';
import type { ExtractedContextArtifact } from './types';
import type { WorkspaceContextPack } from './workspace-context';

type StoredContextArtifactRow = {
  id: string;
  workspace_id: string;
  source_node_id: string;
  source_type: string;
  source_fingerprint: string;
  artifact: ExtractedContextArtifact;
  updated_at?: string;
};

type StoredContextPackRow = {
  workspace_id: string;
  context: WorkspaceContextPack;
  source_fingerprint: string;
  updated_at?: string;
};

export async function loadCachedContextArtifact(
  client: SupabaseClient,
  input: {
    workspaceId: string;
    sourceNodeId: string;
    sourceFingerprint: string;
  },
) {
  const { data, error } = await client
    .from(WORKSPACE_CONTEXT_ARTIFACTS_TABLE)
    .select('id, workspace_id, source_node_id, source_type, source_fingerprint, artifact, updated_at')
    .eq('workspace_id', input.workspaceId)
    .eq('source_node_id', input.sourceNodeId)
    .eq('source_fingerprint', input.sourceFingerprint)
    .maybeSingle<StoredContextArtifactRow>();

  if (error) {
    throw error;
  }

  return data?.artifact ?? null;
}

export async function saveContextArtifact(
  client: SupabaseClient,
  artifact: ExtractedContextArtifact,
) {
  const { error } = await client
    .from(WORKSPACE_CONTEXT_ARTIFACTS_TABLE)
    .upsert(
      {
        workspace_id: artifact.workspaceId,
        source_node_id: artifact.sourceNodeId,
        source_type: artifact.sourceType,
        source_fingerprint: artifact.sourceFingerprint,
        artifact,
      },
      {
        onConflict: 'workspace_id,source_node_id,source_fingerprint',
      },
    );

  if (error) {
    throw error;
  }
}

export async function loadLatestArtifactsForWorkspace(
  client: SupabaseClient,
  workspaceId: string,
) {
  const { data, error } = await client
    .from(WORKSPACE_CONTEXT_ARTIFACTS_TABLE)
    .select('id, workspace_id, source_node_id, source_type, source_fingerprint, artifact, updated_at')
    .eq('workspace_id', workspaceId)
    .returns<StoredContextArtifactRow[]>();

  if (error) {
    throw error;
  }

  const latestBySource = new Map<string, StoredContextArtifactRow>();

  for (const row of data ?? []) {
    const existing = latestBySource.get(row.source_node_id);

    if (!existing || (row.updated_at ?? '') > (existing.updated_at ?? '')) {
      latestBySource.set(row.source_node_id, row);
    }
  }

  return Array.from(latestBySource.values()).map((row) => row.artifact);
}

export async function loadCachedWorkspaceContextPack(
  client: SupabaseClient,
  workspaceId: string,
  sourceFingerprint: string,
) {
  const { data, error } = await client
    .from(WORKSPACE_CONTEXT_PACKS_TABLE)
    .select('workspace_id, context, source_fingerprint, updated_at')
    .eq('workspace_id', workspaceId)
    .eq('source_fingerprint', sourceFingerprint)
    .maybeSingle<StoredContextPackRow>();

  if (error) {
    throw error;
  }

  return data?.context ?? null;
}

export async function saveWorkspaceContextPack(
  client: SupabaseClient,
  input: {
    workspaceId: string;
    sourceFingerprint: string;
    context: WorkspaceContextPack;
  },
) {
  const { error } = await client
    .from(WORKSPACE_CONTEXT_PACKS_TABLE)
    .upsert(
      {
        workspace_id: input.workspaceId,
        source_fingerprint: input.sourceFingerprint,
        context: input.context,
      },
      {
        onConflict: 'workspace_id',
      },
    );

  if (error) {
    throw error;
  }
}
