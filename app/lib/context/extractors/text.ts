import type { ContextSource, ExtractedContextArtifact } from '../types';

function splitLines(value: string | undefined) {
  return (value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function extractTextContext(input: {
  source: Extract<ContextSource, { sourceType: 'note' | 'research' | 'template' | 'generated' }>;
  fingerprint: string;
}) {
  const now = new Date().toISOString();
  const node = input.source.node;
  const textBody = node.data.body?.trim() ?? '';
  const bulletLines = node.data.bullets ?? [];
  const promptLines = [
    node.data.prompt,
    node.data.imagePrompt,
    node.data.videoPrompt,
    node.data.animationPrompt,
  ].filter(Boolean) as string[];
  const summary =
    textBody ||
    node.data.subtitle ||
    `${node.data.kind} node ${node.data.title}`;

  const keyFacts = dedupeText([
    ...splitLines(node.data.body),
    ...bulletLines,
    ...promptLines,
    node.data.title,
    node.data.subtitle,
  ]);
  const styleSignals =
    input.source.sourceType === 'template'
      ? [node.data.subtitle, ...bulletLines, node.data.imagePrompt, node.data.videoPrompt, node.data.animationPrompt]
      : input.source.sourceType === 'generated'
        ? [
            node.data.generationProvider,
            node.data.generationType,
            node.data.aspectRatio,
          ]
      : node.data.chips ?? [];
  const ctas = keyFacts.filter((item) => /cta|call to action|sign up|buy|shop|join|download/i.test(item));
  const constraints = keyFacts.filter((item) => /must|avoid|do not|don't|never|only/i.test(item));
  const productEntities = [node.data.title, node.data.subtitle].filter(Boolean) as string[];

  const artifact: ExtractedContextArtifact = {
    workspaceId: input.source.workspaceId,
    sourceNodeId: input.source.sourceNodeId,
    sourceType: input.source.sourceType,
    sourceFingerprint: input.fingerprint,
    title: node.data.title,
    summary,
    keyFacts,
    styleSignals: styleSignals.filter(Boolean) as string[],
    audienceHints: (node.data.chips ?? []).filter((chip) => !/draft|untested/i.test(chip)),
    constraints,
    claims: keyFacts.filter((item) => /prove|results|metric|claim|benefit/i.test(item)),
    ctas,
    productEntities,
    createdAt: now,
    updatedAt: now,
    rawMetadata: {
      nodeKind: node.data.kind,
      title: node.data.title,
      text: textBody,
      assetItems: (node.data.assetItems ?? []).map((item) => ({
        id: item.id,
        label: item.label,
        type: item.type,
        previewUrl: item.previewUrl,
        storagePath: item.storagePath,
        mimeType: item.mimeType,
      })),
      promptFields: {
        prompt: node.data.prompt,
        imagePrompt: node.data.imagePrompt,
        videoPrompt: node.data.videoPrompt,
        animationPrompt: node.data.animationPrompt,
      },
      template: {
        templateId: node.data.templateId,
        category: node.data.templateCategory,
        description: node.data.templateDescription,
      },
      generation: {
        generationType: node.data.generationType,
        provider: node.data.generationProvider,
        aspectRatio: node.data.aspectRatio,
        negativePrompt: node.data.negativePrompt,
        targetPlatform: node.data.targetPlatform,
      },
    },
  };

  return artifact;
}

function dedupeText(values: Array<string | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);
  }

  return result;
}
