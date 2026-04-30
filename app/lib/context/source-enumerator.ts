import type { ChoiceConfig } from '../campaign/types';
import type { CanvasNode } from '../canvas/types';
import type { ContextSource } from './types';

export function enumerateContextSources(input: {
  workspaceId: string;
  nodes: CanvasNode[];
  choiceConfig: ChoiceConfig | null;
}) {
  const sources: ContextSource[] = [];

  for (const node of input.nodes) {
    if (node.data.kind === 'brainstorm') {
      sources.push({
        workspaceId: input.workspaceId,
        sourceNodeId: node.id,
        sourceType: 'note',
        title: node.data.title,
        node,
      });
      continue;
    }

    if (node.data.kind === 'generation') {
      sources.push({
        workspaceId: input.workspaceId,
        sourceNodeId: node.id,
        sourceType: 'generated',
        title: node.data.title,
        node,
      });
      continue;
    }

    if (node.data.kind === 'research') {
      sources.push({
        workspaceId: input.workspaceId,
        sourceNodeId: node.id,
        sourceType: 'research',
        title: node.data.title,
        node,
      });
      continue;
    }

    if (node.data.kind === 'template') {
      sources.push({
        workspaceId: input.workspaceId,
        sourceNodeId: node.id,
        sourceType: 'template',
        title: node.data.title,
        node,
      });
      continue;
    }

    if (node.data.kind === 'image-stack') {
      sources.push({
        workspaceId: input.workspaceId,
        sourceNodeId: node.id,
        sourceType: 'research',
        title: node.data.title,
        node,
      });
      continue;
    }

    if (node.data.kind === 'asset' && node.data.assetItems?.length) {
      for (const asset of node.data.assetItems) {
        sources.push({
          workspaceId: input.workspaceId,
          sourceNodeId: `${node.id}:${asset.id}`,
          sourceType: asset.type,
          title: asset.label || node.data.title,
          node,
          asset,
        });
      }
    }

  }

  if (input.choiceConfig) {
    sources.push({
      workspaceId: input.workspaceId,
      sourceNodeId: 'choice-config',
      sourceType: 'choice-config',
      title: 'Choice configuration',
      config: input.choiceConfig as Record<string, unknown>,
    });
  }

  return sources;
}
