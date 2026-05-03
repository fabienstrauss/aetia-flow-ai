-- ============================================================
-- Schema — run once against a fresh Supabase project
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Shared updated_at trigger ────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Tables ───────────────────────────────────────────────────

create table public.workspaces (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  owner_id   uuid        not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_workspaces_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

-- Normalized canvas nodes (replaces single JSONB blob per workspace)
create table public.canvas_nodes (
  id           text             not null,
  workspace_id uuid             not null references public.workspaces(id) on delete cascade,
  type         text             not null default 'default',
  position_x   double precision not null default 0,
  position_y   double precision not null default 0,
  data         jsonb            not null default '{}'::jsonb,
  created_at   timestamptz      not null default now(),
  updated_at   timestamptz      not null default now(),
  primary key (workspace_id, id)
);

create trigger set_canvas_nodes_updated_at
  before update on public.canvas_nodes
  for each row execute function public.set_updated_at();

-- Canvas edges (no updated_at — edges are created or deleted, never mutated)
create table public.canvas_edges (
  id           text        not null,
  workspace_id uuid        not null references public.workspaces(id) on delete cascade,
  source       text        not null,
  target       text        not null,
  source_handle text,
  target_handle text,
  primary key (workspace_id, id)
);

-- One config row per workspace (replaces single row keyed by 'main')
create table public.campaign_config (
  workspace_id uuid  primary key references public.workspaces(id) on delete cascade,
  config       jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);

create trigger set_campaign_config_updated_at
  before update on public.campaign_config
  for each row execute function public.set_updated_at();

create table public.workspace_context_artifacts (
  id                uuid        primary key default gen_random_uuid(),
  workspace_id      uuid        not null references public.workspaces(id) on delete cascade,
  source_node_id    text        not null,
  source_type       text        not null,
  source_fingerprint text       not null,
  artifact          jsonb       not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index workspace_context_artifacts_unique_source_idx
  on public.workspace_context_artifacts (workspace_id, source_node_id, source_fingerprint);

create index workspace_context_artifacts_lookup_idx
  on public.workspace_context_artifacts (workspace_id, source_node_id);

create trigger set_workspace_context_artifacts_updated_at
  before update on public.workspace_context_artifacts
  for each row execute function public.set_updated_at();

-- One cached context pack per workspace
create table public.workspace_context_packs (
  workspace_id       uuid        primary key references public.workspaces(id) on delete cascade,
  context            jsonb       not null,
  source_fingerprint text        not null,
  updated_at         timestamptz not null default now()
);

create trigger set_workspace_context_packs_updated_at
  before update on public.workspace_context_packs
  for each row execute function public.set_updated_at();

create table public.generated_content (
  id                    uuid        primary key default gen_random_uuid(),
  workspace_id          uuid        not null references public.workspaces(id) on delete cascade,
  platform              text        not null,
  content_type          text        not null,
  prompt                text        not null,
  storage_path          text        not null,
  public_url            text        not null,
  mime_type             text        not null default 'image/png',
  template_id           text,
  audience              text,
  aspect_ratio          text,
  voiceover_storage_path text,
  voiceover_public_url  text,
  voiceover_mime_type   text,
  voiceover_text        text,
  voiceover_voice_id    text,
  created_at            timestamptz not null default now()
);

create index generated_content_workspace_idx
  on public.generated_content (workspace_id, created_at desc);

-- ── RLS helper ───────────────────────────────────────────────
-- Security definer so the subquery runs as postgres (bypasses workspaces RLS)
-- but still filters by the calling user's uid.
create or replace function public.is_workspace_owner(wid uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.workspaces where id = wid and owner_id = auth.uid()
  );
$$;

-- ── Row-Level Security ───────────────────────────────────────

alter table public.workspaces                  enable row level security;
alter table public.canvas_nodes                enable row level security;
alter table public.canvas_edges                enable row level security;
alter table public.campaign_config             enable row level security;
alter table public.workspace_context_artifacts enable row level security;
alter table public.workspace_context_packs     enable row level security;
alter table public.generated_content           enable row level security;

-- workspaces: owner only
create policy "workspaces: owner"
  on public.workspaces for all
  using  (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- All other tables: accessible only if the user owns the workspace
create policy "canvas_nodes: workspace owner"
  on public.canvas_nodes for all
  using  (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy "canvas_edges: workspace owner"
  on public.canvas_edges for all
  using  (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy "campaign_config: workspace owner"
  on public.campaign_config for all
  using  (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy "workspace_context_artifacts: workspace owner"
  on public.workspace_context_artifacts for all
  using  (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy "workspace_context_packs: workspace owner"
  on public.workspace_context_packs for all
  using  (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy "generated_content: workspace owner"
  on public.generated_content for all
  using  (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

-- ── Storage buckets ──────────────────────────────────────────

insert into storage.buckets (id, name, public)
values
  ('canvas-assets',     'canvas-assets',     true),
  ('templates',         'templates',         true),
  ('generated-content', 'generated-content', true)
on conflict (id) do nothing;

-- canvas-assets: public read, authenticated write
-- (server-side uploads use the admin client and bypass these policies)
create policy "canvas-assets: public read"
  on storage.objects for select
  using (bucket_id = 'canvas-assets');

create policy "canvas-assets: authenticated insert"
  on storage.objects for insert
  with check (bucket_id = 'canvas-assets' and auth.role() = 'authenticated');

create policy "canvas-assets: authenticated delete"
  on storage.objects for delete
  using (bucket_id = 'canvas-assets' and auth.role() = 'authenticated');

-- generated-content: public read, authenticated write
create policy "generated-content: public read"
  on storage.objects for select
  using (bucket_id = 'generated-content');

create policy "generated-content: authenticated insert"
  on storage.objects for insert
  with check (bucket_id = 'generated-content' and auth.role() = 'authenticated');

create policy "generated-content: authenticated delete"
  on storage.objects for delete
  using (bucket_id = 'generated-content' and auth.role() = 'authenticated');

-- templates: public read only (no user uploads)
create policy "templates: public read"
  on storage.objects for select
  using (bucket_id = 'templates');
