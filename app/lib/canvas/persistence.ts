import type { SupabaseClient } from '@supabase/supabase-js';

import { initialNodes } from './sample-data';
import type { CanvasEdge, CanvasNode, CanvasNodeData } from './types';
import { CANVAS_ASSETS_BUCKET, CANVAS_EDGES_TABLE, CANVAS_NODES_TABLE } from '../supabase/constants';

function sanitizeNodeData(data: CanvasNodeData): CanvasNodeData {
  const rest = { ...data };
  delete rest.onUpdate;
  delete rest.onDelete;
  return rest;
}

export function sanitizeNodesForStorage(nodes: CanvasNode[]) {
  return nodes.map((node) => ({
    ...node,
    data: sanitizeNodeData(node.data),
  }));
}

export async function loadCanvasState(client: SupabaseClient, workspaceId: string) {
  const [nodesResult, edgesResult] = await Promise.all([
    client
      .from(CANVAS_NODES_TABLE)
      .select('id, type, position_x, position_y, data')
      .eq('workspace_id', workspaceId),
    client
      .from(CANVAS_EDGES_TABLE)
      .select('id, source, target, source_handle, target_handle')
      .eq('workspace_id', workspaceId),
  ]);

  if (nodesResult.error) throw nodesResult.error;
  if (edgesResult.error) throw edgesResult.error;

  const nodes: CanvasNode[] = (nodesResult.data ?? []).map((row) => ({
    id: row.id as string,
    type: row.type as string,
    position: { x: row.position_x as number, y: row.position_y as number },
    data: row.data as CanvasNodeData,
  }));

  const edges: CanvasEdge[] = (edgesResult.data ?? []).map((row) => ({
    id: row.id as string,
    source: row.source as string,
    target: row.target as string,
    sourceHandle: (row.source_handle as string | null) ?? undefined,
    targetHandle: (row.target_handle as string | null) ?? undefined,
  }));

  return { nodes, edges };
}

export async function saveCanvasState(
  client: SupabaseClient,
  workspaceId: string,
  input: { nodes: CanvasNode[]; edges: CanvasEdge[] },
) {
  const sanitizedNodes = sanitizeNodesForStorage(input.nodes);

  // Replace all nodes and edges for this workspace atomically enough —
  // the canvas is always saved in full, so delete-then-insert is correct.
  await Promise.all([
    client.from(CANVAS_NODES_TABLE).delete().eq('workspace_id', workspaceId),
    client.from(CANVAS_EDGES_TABLE).delete().eq('workspace_id', workspaceId),
  ]);

  if (sanitizedNodes.length > 0) {
    const { error } = await client.from(CANVAS_NODES_TABLE).insert(
      sanitizedNodes.map((node) => ({
        id: node.id,
        workspace_id: workspaceId,
        type: node.type ?? 'default',
        position_x: node.position.x,
        position_y: node.position.y,
        data: node.data,
      })),
    );
    if (error) throw error;
  }

  if (input.edges.length > 0) {
    const { error } = await client.from(CANVAS_EDGES_TABLE).insert(
      input.edges.map((edge) => ({
        id: edge.id,
        workspace_id: workspaceId,
        source: edge.source,
        target: edge.target,
        source_handle: edge.sourceHandle ?? null,
        target_handle: edge.targetHandle ?? null,
      })),
    );
    if (error) throw error;
  }
}

export async function uploadCanvasAsset(
  client: SupabaseClient,
  file: File,
  index: number,
  workspaceId: string,
) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${workspaceId}/${Date.now()}-${index}-${safeName}`;

  const { error } = await client.storage
    .from(CANVAS_ASSETS_BUCKET)
    .upload(path, file, { upsert: true });

  if (error) throw error;

  const { data } = client.storage.from(CANVAS_ASSETS_BUCKET).getPublicUrl(path);

  return { path, publicUrl: data.publicUrl };
}

export function getDefaultCanvasState() {
  return { nodes: sanitizeNodesForStorage(initialNodes), edges: [] };
}
