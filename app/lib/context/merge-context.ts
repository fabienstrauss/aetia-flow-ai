import 'server-only';

import type { ExtractedContextArtifact } from './types';
import type { WorkspaceContextPack } from './workspace-context';

function dedupe(items: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items.map((entry) => entry.trim()).filter(Boolean)) {
    const key = item.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }

  return result;
}

function summarizeCanvas(input: {
  notes: WorkspaceContextPack['notes'];
  templates: WorkspaceContextPack['templates'];
  documents: WorkspaceContextPack['documents'];
  images: WorkspaceContextPack['images'];
  videos: WorkspaceContextPack['videos'];
  generatedContent: WorkspaceContextPack['generatedContent'];
}) {
  const parts = [
    input.notes.length ? `${input.notes.length} note${input.notes.length === 1 ? '' : 's'}` : '',
    input.templates.length
      ? `${input.templates.length} template${input.templates.length === 1 ? '' : 's'}`
      : '',
    input.documents.length
      ? `${input.documents.length} document${input.documents.length === 1 ? '' : 's'}`
      : '',
    input.images.length ? `${input.images.length} image reference${input.images.length === 1 ? '' : 's'}` : '',
    input.videos.length ? `${input.videos.length} video reference${input.videos.length === 1 ? '' : 's'}` : '',
    input.generatedContent.length
      ? `${input.generatedContent.length} generated asset${input.generatedContent.length === 1 ? '' : 's'}`
      : '',
  ].filter(Boolean);

  return parts.length > 0
    ? `This canvas currently holds ${parts.join(', ')}.`
    : 'This canvas does not hold any extracted source material yet.';
}

export function mergeContextArtifacts(input: {
  workspaceId: string;
  sourceFingerprint: string;
  artifacts: ExtractedContextArtifact[];
}): WorkspaceContextPack {
  const notes = input.artifacts
    .filter((artifact) => artifact.sourceType === 'note' || artifact.sourceType === 'research')
    .map((artifact) => ({
      sourceNodeId: artifact.sourceNodeId,
      title: artifact.title ?? 'Untitled note',
      text: (artifact.rawMetadata?.text as string | undefined) ?? artifact.summary,
    }));

  const templates = input.artifacts
    .filter((artifact) => artifact.sourceType === 'template')
    .map((artifact) => {
      const templateMetadata = (artifact.rawMetadata?.template as
        | {
            templateId?: string;
            category?: string;
            description?: string;
          }
        | undefined) ?? {
        };
      const promptFields = (artifact.rawMetadata?.promptFields as
        | {
            imagePrompt?: string;
            videoPrompt?: string;
            animationPrompt?: string;
          }
        | undefined) ?? {
        };

      return {
        sourceNodeId: artifact.sourceNodeId,
        title: artifact.title ?? 'Untitled template',
        templateId: templateMetadata.templateId,
        category: templateMetadata.category,
        description: templateMetadata.description ?? artifact.summary,
        imagePrompt: promptFields.imagePrompt,
        videoPrompt: promptFields.videoPrompt,
        animationPrompt: promptFields.animationPrompt,
      };
    });

  const documents = input.artifacts
    .filter((artifact) => artifact.sourceType === 'document')
    .map((artifact) => ({
      sourceNodeId: artifact.sourceNodeId,
      title: artifact.title ?? 'Untitled document',
      summary: artifact.summary,
      keyFacts: artifact.keyFacts,
      claims: artifact.claims,
      constraints: artifact.constraints,
    }));

  const images = input.artifacts
    .filter((artifact) => artifact.sourceType === 'image')
    .map((artifact) => ({
      sourceNodeId: artifact.sourceNodeId,
      title: artifact.title ?? 'Untitled image',
      description: artifact.summary,
      visibleText: artifact.visibleText ?? [],
      styleSignals: artifact.styleSignals,
      productEntities: artifact.productEntities,
    }));

  const videos = input.artifacts
    .filter((artifact) => artifact.sourceType === 'video')
    .map((artifact) => ({
      sourceNodeId: artifact.sourceNodeId,
      title: artifact.title ?? 'Untitled video',
      description: artifact.summary,
      visibleText: artifact.visibleText ?? [],
      styleSignals: artifact.styleSignals,
      sceneBreakdown: artifact.sceneBreakdown ?? [],
    }));

  const generatedContent = input.artifacts
    .filter((artifact) => artifact.sourceType === 'generated')
    .map((artifact) => {
      const generationMetadata = (artifact.rawMetadata?.generation as
        | {
            generationType?: string;
            provider?: string;
          }
        | undefined) ?? {
        };
      const promptFields = (artifact.rawMetadata?.promptFields as
        | {
            prompt?: string;
          }
        | undefined) ?? {
        };
      const assetItems =
        ((artifact.rawMetadata?.assetItems as Array<{ previewUrl?: string }> | undefined) ?? []);

      return {
        sourceNodeId: artifact.sourceNodeId,
        title: artifact.title ?? 'Untitled generated asset',
        generationType: generationMetadata.generationType,
        provider: generationMetadata.provider,
        prompt: promptFields.prompt,
        assetUrls: dedupe(
          assetItems.map((item) => item.previewUrl ?? '').filter(Boolean),
        ),
      };
    });

  const choiceArtifact = input.artifacts.find((artifact) => artifact.sourceType === 'choice-config');
  const rawPlatforms =
    (choiceArtifact?.rawMetadata?.platforms as Record<
      string,
      {
        audience?: string;
        contentTypes?: string[];
        templates?: Partial<Record<string, string>>;
        aspectRatios?: Partial<Record<string, string>>;
      }
    > | undefined) ?? {};

  const platforms = dedupe(Object.keys(rawPlatforms));
  const requestedContentTypes = dedupe(
    Object.values(rawPlatforms).flatMap((platform) => platform.contentTypes ?? []),
  );
  const selectedTemplates = dedupe(
    Object.values(rawPlatforms).flatMap((platform) =>
      Object.values(platform.templates ?? {}).filter(Boolean) as string[],
    ),
  );
  const audiences = dedupe(
    Object.values(rawPlatforms)
      .map((platform) => platform.audience ?? '')
      .filter(Boolean),
  );
  const aspectRatios = dedupe(
    Object.values(rawPlatforms).flatMap((platform) =>
      Object.values(platform.aspectRatios ?? {}).filter(Boolean) as string[],
    ),
  );

  const baseFacts = dedupe(
    input.artifacts
      .filter((artifact) => artifact.sourceType !== 'choice-config')
      .flatMap((artifact) => artifact.keyFacts),
  );
  const baseEntities = dedupe(
    input.artifacts
      .filter((artifact) => artifact.sourceType !== 'choice-config')
      .flatMap((artifact) => artifact.productEntities),
  );
  const baseConstraints = dedupe(
    input.artifacts
      .filter((artifact) => artifact.sourceType !== 'choice-config')
      .flatMap((artifact) => artifact.constraints),
  );
  const baseClaims = dedupe(
    input.artifacts
      .filter((artifact) => artifact.sourceType !== 'choice-config')
      .flatMap((artifact) => artifact.claims),
  );
  const baseStyles = dedupe(
    input.artifacts
      .filter((artifact) => artifact.sourceType !== 'choice-config')
      .flatMap((artifact) => artifact.styleSignals),
  );

  return {
    workspaceId: input.workspaceId,
    generatedAt: new Date().toISOString(),
    sourceFingerprint: input.sourceFingerprint,
    overview: {
      summary: summarizeCanvas({
        notes,
        templates,
        documents,
        images,
        videos,
        generatedContent,
      }),
      counts: {
        totalSources: input.artifacts.length,
        notes: notes.length,
        templates: templates.length,
        documents: documents.length,
        images: images.length,
        videos: videos.length,
        generatedContent: generatedContent.length,
      },
    },
    notes,
    templates,
    documents,
    images,
    videos,
    generatedContent,
    baseContext: {
      summary: dedupe(
        input.artifacts
          .filter((artifact) => artifact.sourceType !== 'choice-config')
          .map((artifact) => artifact.summary),
      )
        .slice(0, 8)
        .join(' '),
      keyFacts: baseFacts,
      productEntities: baseEntities,
      constraints: baseConstraints,
      claims: baseClaims,
      styleSignals: baseStyles,
    },
    generationIntent: {
      summary:
        platforms.length > 0
          ? `Targeting ${requestedContentTypes.join(', ') || 'content'} for ${platforms.join(', ')}.`
          : 'No generation intent configured yet.',
      platforms,
      requestedContentTypes,
      selectedTemplates,
      audiences,
      aspectRatios,
      rawChoiceConfig: Object.keys(rawPlatforms).length > 0 ? rawPlatforms : null,
    },
    productReferenceUrl: (choiceArtifact?.rawMetadata as any)?.productReferenceUrl,
    sourceArtifacts: input.artifacts,
  };
}
