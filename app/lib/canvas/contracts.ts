import type { CanvasNodeData } from './types';

export type GenerateInput = {
  type: 'image' | 'video' | 'animation';
  prompt: string;
};

export type TavilyInput = {
  query: string;
  includeImages: boolean;
};

export type TemplateInput = {
  templateId: string;
};

export type CanvasInsertionItem = {
  key: string;
  offsetX?: number;
  offsetY?: number;
  data: Omit<CanvasNodeData, 'onUpdate'>;
};

export type CanvasInsertionEdge = {
  sourceKey: string;
  targetKey: string;
};

export type CanvasInsertionPayload = {
  items: CanvasInsertionItem[];
  edges?: CanvasInsertionEdge[];
};
