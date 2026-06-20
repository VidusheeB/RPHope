-- RP Hope — research_items table
--
-- The Opus "research pulling" element drafts new research per gene (Opus runs the
-- web_search tool across many academic sources) and stores each item HERE, not in the
-- genes.research_items jsonb column. Reason (governance): genes.status is per-ROW and
-- RLS exposes the whole row once a gene is `published`, so appending an unreviewed item
-- to a published gene would leak it live. A separate table gives each research item its
-- OWN review status, so every new research claim is `pending_review` until a human
-- approves it (see CLAUDE.md → Content governance).
--
-- title / source_url come from Opus's real web-search results (never invented URLs) and
-- why_it_matters is AI-drafted — all reviewed by a human before publish.
--
-- Apply with the Supabase SQL editor or `supabase db push`.

create extension if not exists "uuid-ossp";

do $$ begin
  create type research_status as enum ('pending_review', 'published', 'rejected');
exception when duplicate_object then null;
end $$;

create table if not exists research_items (
  id              uuid primary key default uuid_generate_v4(),
  gene_slug       text not null,                                   -- matches genes.slug / geneGrid slug
  source          text not null,                                   -- domain label: 'pubmed', 'clinicaltrials', 'nature.com', …
  external_id     text not null,                                   -- normalized source URL — dedup key
  title           text not null,                                   -- real title from web-search results (human-reviewed)
  source_url      text not null,                                   -- real URL from web-search results
  published_label text,                                            -- human-readable date from the source
  why_it_matters  text,                                            -- the ONLY AI-drafted field (Opus)

  status          research_status not null default 'pending_review',
  created_at      timestamptz not null default now(),
  reviewed_by     text,
  reviewed_at     timestamptz,

  unique (gene_slug, source, external_id)                          -- never insert the same item twice
);

create index if not exists research_items_gene_idx on research_items (gene_slug);
create index if not exists research_items_status_idx on research_items (status);

-- Row Level Security: the public site only ever reads PUBLISHED research items.
alter table research_items enable row level security;

drop policy if exists "public reads published research" on research_items;
create policy "public reads published research"
  on research_items for select
  using (status = 'published');

-- (No public insert/update policy: the cron writes with the service-role key, which
--  bypasses RLS. Reviewers approve by setting status = 'published' in the Table Editor.)
