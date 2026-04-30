import type { CanvasAssetItem, CanvasNode } from '../canvas/types';

export type ContextSourceType =
  | 'note'
  | 'research'
  | 'template'
  | 'generated'
  | 'image'
  | 'video'
  | 'document'
  | 'choice-config';

export type ExtractedContextArtifact = {
  workspaceId: string;
  sourceNodeId: string;
  sourceType: ContextSourceType;
  sourceFingerprint: string;
  title?: string;
  summary: string;
  keyFacts: string[];
  styleSignals: string[];
  audienceHints: string[];
  constraints: string[];
  claims: string[];
  ctas: string[];
  productEntities: string[];
  visibleText?: string[];
  sceneBreakdown?: Array<{
    label: string;
    timestampStart?: number;
    timestampEnd?: number;
    description: string;
  }>;
  rawMetadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ContextSource =
  | {
      workspaceId: string;
      sourceNodeId: string;
      sourceType: 'note' | 'research' | 'template' | 'generated';
      title?: string;
      node: CanvasNode;
    }
  | {
      workspaceId: string;
      sourceNodeId: string;
      sourceType: 'image' | 'video' | 'document';
      title?: string;
      node: CanvasNode;
      asset: CanvasAssetItem;
    }
  | {
      workspaceId: string;
      sourceNodeId: 'choice-config';
      sourceType: 'choice-config';
      title?: string;
      config: Record<string, unknown>;
    };
