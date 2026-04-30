import 'server-only';

import type { CanvasAssetItem } from '../canvas/types';
import type { ContextSourceType, ExtractedContextArtifact } from '../context/types';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_CONTEXT_MODEL = 'gemini-2.5-flash';

type GeminiUploadResponse = {
  file?: {
    uri?: string;
    mimeType?: string;
  };
};

type GeminiContextResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

const MAX_INLINE_DOCUMENT_BYTES = 20 * 1024 * 1024;

function getGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY');
  }

  return apiKey;
}

function getAssetUrl(asset: CanvasAssetItem) {
  if (!asset.previewUrl || asset.previewUrl.startsWith('blob:')) {
    throw new Error(`Asset ${asset.label} is not available from a persistent URL`);
  }

  return asset.previewUrl;
}

function inferDocumentMimeType(asset: CanvasAssetItem) {
  const label = asset.label.toLowerCase();

  if (asset.mimeType && asset.mimeType !== 'application/octet-stream') {
    return asset.mimeType;
  }

  if (label.endsWith('.pdf')) {
    return 'application/pdf';
  }

  if (label.endsWith('.txt')) {
    return 'text/plain';
  }

  if (label.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  if (label.endsWith('.doc')) {
    return 'application/msword';
  }

  if (label.endsWith('.pptx')) {
    return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  }

  if (label.endsWith('.ppt')) {
    return 'application/vnd.ms-powerpoint';
  }

  return asset.mimeType ?? 'application/octet-stream';
}

function createFallbackMediaArtifact(input: {
  sourceType: 'image' | 'video' | 'document';
  title?: string;
  asset: CanvasAssetItem;
}): Omit<
  ExtractedContextArtifact,
  'workspaceId' | 'sourceNodeId' | 'sourceType' | 'sourceFingerprint' | 'createdAt' | 'updatedAt'
> {
  return {
    title: input.title ?? input.asset.label,
    summary:
      input.sourceType === 'document'
        ? `${input.asset.label} is attached as a document reference on the canvas.`
        : input.sourceType === 'video'
          ? `${input.asset.label} is attached as a video reference on the canvas.`
          : `${input.asset.label} is attached as an image reference on the canvas.`,
    keyFacts: [input.asset.label, input.asset.meta].filter(Boolean),
    styleSignals: [],
    audienceHints: [],
    constraints: [],
    claims: [],
    ctas: [],
    productEntities: [],
    visibleText: [],
    sceneBreakdown:
      input.sourceType === 'video'
        ? [
            {
              label: 'Attached video',
              description: 'Video asset is present, but detailed Gemini extraction was unavailable for this pass.',
            },
          ]
        : [],
    rawMetadata: {
      fallback: true,
    },
  };
}

async function uploadRemoteAssetToGemini(asset: CanvasAssetItem) {
  const { bytes } = await fetchPersistentAssetBytes(asset);
  const apiKey = getGeminiApiKey();
  const response = await fetch(`${GEMINI_API_BASE}/files?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'raw',
      'X-Goog-Upload-File-Name': asset.label,
      'Content-Type':
        asset.type === 'document'
          ? inferDocumentMimeType(asset)
          : asset.mimeType ?? 'application/octet-stream',
    },
    body: bytes,
  });

  if (!response.ok) {
    throw new Error(`Gemini file upload failed: ${response.status} ${await response.text()}`);
  }

  const json = (await response.json()) as GeminiUploadResponse;
  const uri = json.file?.uri;

  if (!uri) {
    throw new Error('Gemini file upload returned no file URI');
  }

  return {
    uri,
    mimeType:
      json.file?.mimeType ??
      (asset.type === 'document'
        ? inferDocumentMimeType(asset)
        : asset.mimeType ?? 'application/octet-stream'),
  };
}

async function fetchPersistentAssetBytes(asset: CanvasAssetItem) {
  const assetUrl = getAssetUrl(asset);
  const response = await fetch(assetUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch asset for context extraction: ${response.status}`);
  }

  return {
    assetUrl,
    bytes: Buffer.from(await response.arrayBuffer()),
  };
}

function getExtractionInstruction(sourceType: ContextSourceType) {
  if (sourceType === 'image') {
    return 'Analyze the image and return structured JSON covering summary, keyFacts, styleSignals, audienceHints, constraints, claims, ctas, productEntities, visibleText, and rawMetadata. Be conservative. Do not invent facts not visually supported.';
  }

  if (sourceType === 'video') {
    return 'Analyze the video and return structured JSON covering summary, keyFacts, styleSignals, audienceHints, constraints, claims, ctas, productEntities, visibleText, sceneBreakdown, and rawMetadata. Include notable scene changes and pacing observations.';
  }

  return 'Analyze the document and return structured JSON covering summary, keyFacts, styleSignals, audienceHints, constraints, claims, ctas, productEntities, visibleText, and rawMetadata. Focus on product facts, claims, brand guidance, and explicit constraints.';
}

async function requestStructuredMediaExtraction(input: {
  sourceType: ContextSourceType;
  title?: string;
  fileUri: string;
  mimeType: string;
}) {
  const apiKey = getGeminiApiKey();
  const response = await fetch(
    `${GEMINI_API_BASE}/models/${GEMINI_CONTEXT_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: getExtractionInstruction(input.sourceType) }],
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: [
                  'Return only valid JSON.',
                  `Source title: ${input.title ?? 'Untitled asset'}.`,
                  `Source type: ${input.sourceType}.`,
                ].join('\n'),
              },
              {
                fileData: {
                  fileUri: input.fileUri,
                  mimeType: input.mimeType,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            required: [
              'summary',
              'keyFacts',
              'styleSignals',
              'audienceHints',
              'constraints',
              'claims',
              'ctas',
              'productEntities',
            ],
            properties: {
              summary: { type: 'string' },
              keyFacts: { type: 'array', items: { type: 'string' } },
              styleSignals: { type: 'array', items: { type: 'string' } },
              audienceHints: { type: 'array', items: { type: 'string' } },
              constraints: { type: 'array', items: { type: 'string' } },
              claims: { type: 'array', items: { type: 'string' } },
              ctas: { type: 'array', items: { type: 'string' } },
              productEntities: { type: 'array', items: { type: 'string' } },
              visibleText: { type: 'array', items: { type: 'string' } },
              sceneBreakdown: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['label', 'description'],
                  properties: {
                    label: { type: 'string' },
                    timestampStart: { type: 'number' },
                    timestampEnd: { type: 'number' },
                    description: { type: 'string' },
                  },
                },
              },
              rawMetadata: { type: 'object' },
            },
          },
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini context extraction failed: ${response.status} ${await response.text()}`);
  }

  const json = (await response.json()) as GeminiContextResponse;
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini context extraction returned no structured JSON');
  }

  return JSON.parse(text) as Omit<
    ExtractedContextArtifact,
    'workspaceId' | 'sourceNodeId' | 'sourceType' | 'sourceFingerprint' | 'createdAt' | 'updatedAt'
  >;
}

async function requestStructuredInlineDocumentExtraction(input: {
  title?: string;
  bytes: Buffer;
  mimeType: string;
}) {
  const apiKey = getGeminiApiKey();
  const response = await fetch(
    `${GEMINI_API_BASE}/models/${GEMINI_CONTEXT_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: getExtractionInstruction('document') }],
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: [
                  'Return only valid JSON.',
                  `Source title: ${input.title ?? 'Untitled document'}.`,
                  'Source type: document.',
                ].join('\n'),
              },
              {
                inlineData: {
                  mimeType: input.mimeType,
                  data: input.bytes.toString('base64'),
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            required: [
              'summary',
              'keyFacts',
              'styleSignals',
              'audienceHints',
              'constraints',
              'claims',
              'ctas',
              'productEntities',
            ],
            properties: {
              summary: { type: 'string' },
              keyFacts: { type: 'array', items: { type: 'string' } },
              styleSignals: { type: 'array', items: { type: 'string' } },
              audienceHints: { type: 'array', items: { type: 'string' } },
              constraints: { type: 'array', items: { type: 'string' } },
              claims: { type: 'array', items: { type: 'string' } },
              ctas: { type: 'array', items: { type: 'string' } },
              productEntities: { type: 'array', items: { type: 'string' } },
              visibleText: { type: 'array', items: { type: 'string' } },
              rawMetadata: { type: 'object' },
            },
          },
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Gemini inline document extraction failed: ${response.status} ${await response.text()}`,
    );
  }

  const json = (await response.json()) as GeminiContextResponse;
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini inline document extraction returned no structured JSON');
  }

  return JSON.parse(text) as Omit<
    ExtractedContextArtifact,
    'workspaceId' | 'sourceNodeId' | 'sourceType' | 'sourceFingerprint' | 'createdAt' | 'updatedAt'
  >;
}

export async function extractMediaContextWithGemini(input: {
  workspaceId: string;
  sourceNodeId: string;
  sourceType: 'image' | 'video' | 'document';
  sourceFingerprint: string;
  title?: string;
  asset: CanvasAssetItem;
}) {
  const now = new Date().toISOString();
  let extracted: Omit<
    ExtractedContextArtifact,
    'workspaceId' | 'sourceNodeId' | 'sourceType' | 'sourceFingerprint' | 'createdAt' | 'updatedAt'
  >;

  try {
    if (input.sourceType === 'document') {
      const mimeType = inferDocumentMimeType(input.asset);
      const { bytes } = await fetchPersistentAssetBytes(input.asset);

      if (mimeType === 'application/pdf' && bytes.byteLength <= MAX_INLINE_DOCUMENT_BYTES) {
        extracted = await requestStructuredInlineDocumentExtraction({
          title: input.title,
          bytes,
          mimeType,
        });
      } else {
        const uploadedFile = await uploadRemoteAssetToGemini(input.asset);
        extracted = await requestStructuredMediaExtraction({
          sourceType: input.sourceType,
          title: input.title,
          fileUri: uploadedFile.uri,
          mimeType: uploadedFile.mimeType,
        });
      }
    } else {
      const uploadedFile = await uploadRemoteAssetToGemini(input.asset);
      extracted = await requestStructuredMediaExtraction({
        sourceType: input.sourceType,
        title: input.title,
        fileUri: uploadedFile.uri,
        mimeType: uploadedFile.mimeType,
      });
    }
  } catch {
    extracted = createFallbackMediaArtifact({
      sourceType: input.sourceType,
      title: input.title,
      asset: input.asset,
    });
  }

  const artifact: ExtractedContextArtifact = {
    workspaceId: input.workspaceId,
    sourceNodeId: input.sourceNodeId,
    sourceType: input.sourceType,
    sourceFingerprint: input.sourceFingerprint,
    title: input.title ?? input.asset.label,
    summary: extracted.summary,
    keyFacts: extracted.keyFacts,
    styleSignals: extracted.styleSignals,
    audienceHints: extracted.audienceHints,
    constraints: extracted.constraints,
    claims: extracted.claims,
    ctas: extracted.ctas,
    productEntities: extracted.productEntities,
    visibleText: extracted.visibleText,
    sceneBreakdown: extracted.sceneBreakdown,
    rawMetadata: {
      ...(extracted.rawMetadata ?? {}),
      asset: {
        label: input.asset.label,
        type: input.asset.type,
        storagePath: input.asset.storagePath,
        previewUrl: input.asset.previewUrl,
        mimeType: input.asset.mimeType,
        sizeBytes: input.asset.sizeBytes,
      },
    },
    createdAt: now,
    updatedAt: now,
  };

  return artifact;
}
