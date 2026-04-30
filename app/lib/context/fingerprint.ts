import { createHash } from 'crypto';

import type { ChoiceConfig } from '../campaign/types';
import type { CanvasAssetItem, CanvasNode } from '../canvas/types';
import type { ContextSource } from './types';

const CONTEXT_EXTRACTOR_VERSION = '2026-04-25-v2';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`);

  return `{${entries.join(',')}}`;
}

export function createDeterministicHash(input: unknown) {
  return createHash('sha256').update(stableStringify(input)).digest('hex');
}

function getNodeTextFingerprintPayload(node: CanvasNode) {
  return {
    id: node.id,
    kind: node.data.kind,
    title: node.data.title,
    subtitle: node.data.subtitle,
    body: node.data.body,
    bullets: node.data.bullets,
    prompt: node.data.prompt,
    imagePrompt: node.data.imagePrompt,
    videoPrompt: node.data.videoPrompt,
    animationPrompt: node.data.animationPrompt,
    templateId: node.data.templateId,
    chips: node.data.chips,
  };
}

function getAssetFingerprintPayload(node: CanvasNode, asset: CanvasAssetItem) {
  return {
    nodeId: node.id,
    kind: node.data.kind,
    title: node.data.title,
    assetId: asset.id,
    label: asset.label,
    type: asset.type,
    storagePath: asset.storagePath,
    previewUrl: asset.previewUrl,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    lastModified: asset.lastModified,
  };
}

export function createChoiceConfigFingerprint(config: ChoiceConfig | null) {
  return createDeterministicHash({
    extractorVersion: CONTEXT_EXTRACTOR_VERSION,
    config: config ?? {},
  });
}

export function createContextSourceFingerprint(source: ContextSource) {
  if (source.sourceType === 'choice-config') {
    return createDeterministicHash({
      extractorVersion: CONTEXT_EXTRACTOR_VERSION,
      source: source.config,
    });
  }

  if (source.sourceType === 'image' || source.sourceType === 'video' || source.sourceType === 'document') {
    return createDeterministicHash({
      extractorVersion: CONTEXT_EXTRACTOR_VERSION,
      source: getAssetFingerprintPayload(source.node, source.asset),
    });
  }

  return createDeterministicHash({
    extractorVersion: CONTEXT_EXTRACTOR_VERSION,
    source: getNodeTextFingerprintPayload(source.node),
  });
}
