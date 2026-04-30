alter table if exists public.generated_content
  add column if not exists voiceover_storage_path text,
  add column if not exists voiceover_public_url text,
  add column if not exists voiceover_mime_type text,
  add column if not exists voiceover_text text,
  add column if not exists voiceover_voice_id text;
