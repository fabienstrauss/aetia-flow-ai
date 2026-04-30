import 'server-only';

import type { CanvasInsertionPayload, TavilyInput } from '../canvas/contracts';
import { getRequiredServerEnv } from './env';

type TavilySearchResult = {
  title?: string;
  url?: string;
  content?: string;
};

type TavilyImage =
  | string
  | {
      url?: string;
      description?: string;
    };

type TavilySearchResponse = {
  answer?: string;
  results?: TavilySearchResult[];
  images?: TavilyImage[];
};

function hostnameFromUrl(url?: string) {
  if (!url) {
    return 'source';
  }

  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'source';
  }
}

export function isTavilyConfigured() {
  return Boolean(process.env.TAVILY_API_KEY);
}

export async function searchWithTavily(
  input: TavilyInput,
): Promise<CanvasInsertionPayload> {
  const apiKey = getRequiredServerEnv('TAVILY_API_KEY');

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: input.query,
      topic: 'general',
      search_depth: 'advanced',
      max_results: 5,
      include_answer: 'advanced',
      include_images: input.includeImages,
      include_image_descriptions: input.includeImages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tavily request failed: ${response.status} ${errorText}`);
  }

  const json = (await response.json()) as TavilySearchResponse;
  const bullets =
    json.results?.slice(0, 3).map((result) => {
      const source = hostnameFromUrl(result.url);
      const summary = result.content?.slice(0, 120)?.trim() ?? result.title ?? 'Relevant result';
      return `${source}: ${summary}`;
    }) ?? [];

  const payload: CanvasInsertionPayload = {
    items: [
      {
        key: 'research-note',
        offsetX: input.includeImages ? -170 : 0,
        data: {
          kind: 'research',
          badge: 'Tavily Research',
          title: `Research for "${input.query}"`,
          subtitle: 'Live Tavily search output',
          accent: 'from-cyan-100 via-white to-blue-50',
          body:
            json.answer ??
            `No synthesized answer returned for ${input.query}, but sources were retrieved.`,
          bullets,
        },
      },
    ],
  };

  if (!input.includeImages) {
    return payload;
  }

  const imageItems =
    json.images?.flatMap((image, index) => {
      const imageUrl = typeof image === 'string' ? image : image.url;
      if (!imageUrl) {
        return [];
      }

      return [
        {
          imageUrl,
          label:
            typeof image === 'string'
              ? `Tavily image ${index + 1}`
              : image.description?.trim().slice(0, 48) || `Tavily image ${index + 1}`,
        },
      ];
    }).slice(0, 3) ?? [];

  if (!imageItems.length) {
    return payload;
  }

  imageItems.forEach((image, index) => {
    payload.items.push({
      key: `research-image-${index}`,
      offsetX: 170 + index * 54,
      offsetY: 28 + index * 40,
      data: {
        kind: 'asset',
        badge: 'Tavily Image',
        title: image.label,
        subtitle: 'Pinned from Tavily image results',
        accent: 'from-slate-100 via-white to-zinc-50',
        hideAssetMeta: true,
        assetItems: [
          {
            id: `tavily-image-${index}`,
            label: image.label,
            type: 'image',
            meta: 'Reference image from Tavily',
            previewUrl: image.imageUrl,
          },
        ],
      },
    });
  });

  return payload;
}
