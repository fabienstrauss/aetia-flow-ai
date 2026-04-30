import type { ChoiceConfig } from '../../campaign/types';
import type { ContextSource, ExtractedContextArtifact } from '../types';

export async function extractChoiceConfigContext(input: {
  source: Extract<ContextSource, { sourceType: 'choice-config' }>;
  fingerprint: string;
}) {
  const now = new Date().toISOString();
  const config = input.source.config as ChoiceConfig;
  const platformEntries = Object.entries(config.platforms ?? {});

  const keyFacts = platformEntries.flatMap(([platform, platformConfig]) => {
    if (!platformConfig) {
      return [];
    }

    const audience = platformConfig.audience ? `Audience for ${platform}: ${platformConfig.audience}` : null;
    const contentTypes = platformConfig.contentTypes.length
      ? `Requested content for ${platform}: ${platformConfig.contentTypes.join(', ')}`
      : null;

    return [audience, contentTypes].filter(Boolean) as string[];
  });

  const selectedTemplates = platformEntries.flatMap(([, platformConfig]) =>
    Object.values(platformConfig?.templates ?? {}).filter(Boolean) as string[],
  );

  const artifact: ExtractedContextArtifact = {
    workspaceId: input.source.workspaceId,
    sourceNodeId: input.source.sourceNodeId,
    sourceType: 'choice-config',
    sourceFingerprint: input.fingerprint,
    title: 'Choice configuration',
    summary:
      platformEntries.length > 0
        ? `Configured for ${platformEntries.map(([platform]) => platform).join(', ')}`
        : 'No platform choices configured yet.',
    keyFacts,
    styleSignals: [],
    audienceHints: platformEntries.flatMap(([, platformConfig]) =>
      platformConfig?.audience ? [platformConfig.audience] : [],
    ),
    constraints: [],
    claims: [],
    ctas: [],
    productEntities: selectedTemplates,
    createdAt: now,
    updatedAt: now,
    rawMetadata: {
      platforms: config.platforms,
    },
  };

  return artifact;
}
