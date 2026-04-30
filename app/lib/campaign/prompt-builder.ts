import { contentTemplates } from '../templates/catalog';
import type { WorkspaceContextPack } from '../context/workspace-context';
import type { ContentTypeId, AspectRatioId } from './types';

const AUDIENCE_LABELS: Record<string, string> = {
  genz: 'Gen Z / Alpha — fast, authentic, trend-led',
  millennials: 'Millennials — value-driven, experience-first',
  pro: 'Professionals — insightful, career-focused',
  tech: 'Tech Savvy — detailed, innovation-led',
};

const PLATFORM_NAMES: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  twitter: 'X / Twitter',
  youtube: 'YouTube',
};

const ASPECT_RATIO_LABELS: Record<AspectRatioId, string> = {
  vertical: '9:16 vertical',
  square: '1:1 square',
  horizontal: '16:9 horizontal',
};

export function buildMasterPrompt(input: {
  platform: string;
  contentType: ContentTypeId;
  audience: string;
  aspectRatio: AspectRatioId;
  templateId?: string;
  contextPack: WorkspaceContextPack;
}): string {
  const platformName = PLATFORM_NAMES[input.platform] ?? input.platform;
  const audienceLabel = AUDIENCE_LABELS[input.audience] ?? input.audience;
  const aspectLabel = ASPECT_RATIO_LABELS[input.aspectRatio] ?? input.aspectRatio;
  const template = contentTemplates.find((t) => t.id === input.templateId);

  const { baseContext, images } = input.contextPack;

  const bullets = (items: string[], max = 6) =>
    items
      .slice(0, max)
      .map((s) => `- ${s}`)
      .join('\n');

  const referenceImagesSection = images.length > 0 
    ? `
## Visual Reference Concepts
The following image concepts from the workspace should guide the visual direction:
${images.map(img => `### ${img.title}\n- Description: ${img.description}\n- Style: ${img.styleSignals.join(', ')}`).join('\n\n')}`
    : '';

  const templateSection = template
    ? `
## Template Style Reference
Template: ${template.title} (${template.category}) — ${template.vibe}
${template.description}
Style direction: ${
        input.contentType === 'image'
          ? template.imagePrompt
          : template.videoPrompt
      }`
    : '';

  if (input.contentType === 'image') {
    return `Generate a polished ${platformName} social media image.

## MANDATE: AUTHENTICITY & VISUAL GROUNDING
- AVOID marketing jargon, generic buzzwords, and "corporate-speak".
- FOCUS on photorealistic textures, lighting, and composition.
- PRIORITY: The product/brand identity must be the hero, naturally integrated into the scene.

## Brand & Product Core (Highest Priority)
${baseContext.summary}

## Product Details (Secondary Priority)
${bullets(baseContext.keyFacts, 4)}

## Visual Style & Aesthetics
${bullets(baseContext.styleSignals, 5)}
${baseContext.constraints.length ? `\n## Hard Constraints\n${bullets(baseContext.constraints, 3)}` : ''}
${referenceImagesSection}
${templateSection}

## Format Specifications
- Platform: ${platformName}
- Format: ${aspectLabel}
- Audience: ${audienceLabel}

Produce a cohesive, professional-quality image. Use the visual reference concepts as the PRIMARY guide for style and consistency. No text overlays.`.trim();
  }

  return `Generate a short social media ${input.contentType} for ${platformName}.

## MANDATE: AUTHENTICITY & PACING
- AVOID buzzwords and over-the-top marketing claims.
- FOCUS on high-end production value and atmospheric lighting.
- PRIORITY: Visual storytelling over explicit messaging.

## Brand & Product Core (Highest Priority)
${baseContext.summary}

## Product Details (Secondary Priority)
${bullets(baseContext.keyFacts, 4)}

## Visual Style & Aesthetics
${bullets(baseContext.styleSignals, 5)}
${baseContext.constraints.length ? `\n## Hard Constraints\n${bullets(baseContext.constraints, 3)}` : ''}
${templateSection}

## Format Specifications
- Platform: ${platformName}
- Aspect ratio: ${aspectLabel}
- Audience: ${audienceLabel}

Produce a compelling video. The visual reference concepts should be the PRIMARY guide for consistency. Keep it under 15 seconds.`.trim();
}
