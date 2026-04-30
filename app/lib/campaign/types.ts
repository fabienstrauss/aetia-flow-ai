export type ContentTypeId = 'video' | 'image';

export type AspectRatioId = 'vertical' | 'square' | 'horizontal';

export type PlatformId =
  | 'instagram'
  | 'tiktok'
  | 'linkedin'
  | 'twitter'
  | 'youtube';

export type PlatformConfig = {
  audience: string;
  contentTypes: ContentTypeId[];
  templates: Partial<Record<ContentTypeId, string>>;
  aspectRatios: Partial<Record<ContentTypeId, AspectRatioId>>;
};

export type ChoiceConfig = {
  platforms: Partial<Record<PlatformId, PlatformConfig>>;
  productReferenceUrl?: string;
};

export type GeneratedContentRecord = {
  id: string;
  workspace_id: string;
  platform: string;
  content_type: ContentTypeId;
  prompt: string;
  storage_path: string;
  public_url: string;
  mime_type: string;
  template_id: string | null;
  audience: string | null;
  aspect_ratio: string | null;
  voiceover_storage_path: string | null;
  voiceover_public_url: string | null;
  voiceover_mime_type: string | null;
  voiceover_text: string | null;
  voiceover_voice_id: string | null;
  created_at: string;
};
