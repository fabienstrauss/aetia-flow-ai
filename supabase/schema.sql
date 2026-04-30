create extension if not exists pgcrypto;

create table if not exists public.canvas_state (
  id text primary key,
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_canvas_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists canvas_state_set_updated_at on public.canvas_state;

create trigger canvas_state_set_updated_at
before update on public.canvas_state
for each row
execute function public.set_canvas_state_updated_at();

insert into public.canvas_state (id, nodes, edges)
values ('main', '[]'::jsonb, '[]'::jsonb)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('canvas-assets', 'canvas-assets', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('templates', 'templates', true)
on conflict (id) do nothing;

-- Campaign config (choice screen selections)
create table if not exists public.campaign_config (
  id text primary key,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_campaign_config_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists campaign_config_set_updated_at on public.campaign_config;

create trigger campaign_config_set_updated_at
before update on public.campaign_config
for each row
execute function public.set_campaign_config_updated_at();

insert into public.campaign_config (id, config)
values ('main', '{}'::jsonb)
on conflict (id) do nothing;

-- Extracted workspace context artifacts
create table if not exists public.workspace_context_artifacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  source_node_id text not null,
  source_type text not null,
  source_fingerprint text not null,
  artifact jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists workspace_context_artifacts_unique_source_fingerprint_idx
  on public.workspace_context_artifacts (workspace_id, source_node_id, source_fingerprint);

create index if not exists workspace_context_artifacts_workspace_node_idx
  on public.workspace_context_artifacts (workspace_id, source_node_id);

create or replace function public.set_workspace_context_artifacts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists workspace_context_artifacts_set_updated_at on public.workspace_context_artifacts;

create trigger workspace_context_artifacts_set_updated_at
before update on public.workspace_context_artifacts
for each row
execute function public.set_workspace_context_artifacts_updated_at();

-- Cached merged workspace context pack
create table if not exists public.workspace_context_packs (
  workspace_id text primary key,
  context jsonb not null,
  source_fingerprint text not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_workspace_context_packs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists workspace_context_packs_set_updated_at on public.workspace_context_packs;

create trigger workspace_context_packs_set_updated_at
before update on public.workspace_context_packs
for each row
execute function public.set_workspace_context_packs_updated_at();

create table if not exists public.workspace_context_artifacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  source_node_id text not null,
  source_type text not null,
  source_fingerprint text not null,
  artifact jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists workspace_context_artifacts_unique_source
on public.workspace_context_artifacts (workspace_id, source_node_id, source_fingerprint);

create index if not exists workspace_context_artifacts_lookup_idx
on public.workspace_context_artifacts (workspace_id, source_node_id);

create or replace function public.set_workspace_context_artifacts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists workspace_context_artifacts_set_updated_at on public.workspace_context_artifacts;

create trigger workspace_context_artifacts_set_updated_at
before update on public.workspace_context_artifacts
for each row
execute function public.set_workspace_context_artifacts_updated_at();

create table if not exists public.workspace_context_packs (
  workspace_id text primary key,
  context jsonb not null,
  source_fingerprint text not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_workspace_context_packs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists workspace_context_packs_set_updated_at on public.workspace_context_packs;

create trigger workspace_context_packs_set_updated_at
before update on public.workspace_context_packs
for each row
execute function public.set_workspace_context_packs_updated_at();

-- Generated campaign content
create table if not exists public.generated_content (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'main',
  platform text not null,
  content_type text not null,
  prompt text not null,
  storage_path text not null,
  public_url text not null,
  mime_type text not null default 'image/png',
  template_id text,
  audience text,
  aspect_ratio text,
  voiceover_storage_path text,
  voiceover_public_url text,
  voiceover_mime_type text,
  voiceover_text text,
  voiceover_voice_id text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists generated_content_workspace_idx
  on public.generated_content (workspace_id, created_at desc);

insert into storage.buckets (id, name, public)
values ('generated-content', 'generated-content', true)
on conflict (id) do nothing;

create policy "generated-content: public read"
  on storage.objects for select
  using (bucket_id = 'generated-content');

create policy "generated-content: public insert"
  on storage.objects for insert
  with check (bucket_id = 'generated-content');

create policy "generated-content: public delete"
  on storage.objects for delete
  using (bucket_id = 'generated-content');

alter table if exists public.generated_content
  add column if not exists voiceover_storage_path text,
  add column if not exists voiceover_public_url text,
  add column if not exists voiceover_mime_type text,
  add column if not exists voiceover_text text,
  add column if not exists voiceover_voice_id text;
