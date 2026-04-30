import type { ExtractedContextArtifact } from './types';

export type WorkspaceContextPack = {
  workspaceId: string;
  generatedAt: string;
  sourceFingerprint?: string;
  overview: {
    summary: string;
    counts: {
      totalSources: number;
      notes: number;
      templates: number;
      documents: number;
      images: number;
      videos: number;
      generatedContent: number;
    };
  };
  notes: Array<{
    sourceNodeId: string;
    title: string;
    text: string;
  }>;
  templates: Array<{
    sourceNodeId: string;
    title: string;
    templateId?: string;
    category?: string;
    description?: string;
    imagePrompt?: string;
    videoPrompt?: string;
    animationPrompt?: string;
  }>;
  documents: Array<{
    sourceNodeId: string;
    title: string;
    summary: string;
    keyFacts: string[];
    claims: string[];
    constraints: string[];
  }>;
  images: Array<{
    sourceNodeId: string;
    title: string;
    description: string;
    visibleText: string[];
    styleSignals: string[];
    productEntities: string[];
  }>;
  videos: Array<{
    sourceNodeId: string;
    title: string;
    description: string;
    visibleText: string[];
    styleSignals: string[];
    sceneBreakdown: Array<{
      label: string;
      timestampStart?: number;
      timestampEnd?: number;
      description: string;
    }>;
  }>;
  generatedContent: Array<{
    sourceNodeId: string;
    title: string;
    generationType?: string;
    provider?: string;
    prompt?: string;
    assetUrls: string[];
  }>;
  baseContext: {
    summary: string;
    keyFacts: string[];
    productEntities: string[];
    constraints: string[];
    claims: string[];
    styleSignals: string[];
  };
  generationIntent: {
    summary: string;
    platforms: string[];
    requestedContentTypes: string[];
    selectedTemplates: string[];
    audiences: string[];
    aspectRatios: string[];
    rawChoiceConfig: Record<string, unknown> | null;
  };
  productReferenceUrl?: string;
  sourceArtifacts: ExtractedContextArtifact[];
};
