-- RP Hope — gene_page_drafts table
--
-- Full AI-drafted Genetic Insights page content, one row per generation run.
-- Mirrors the research_items pattern (0001_research_items.sql): AI may draft
-- freely, but nothing here is public or feeds the live gene pages until a human
-- reviewer flips review_status to 'published' (see CLAUDE.md → Content
-- governance). A gene can have multiple draft rows over time (re-generations);
-- the reviewer picks which one (if any) to publish.
--
-- Narrative fields are stored as JSONB in the { text, sourceIds } shape the
-- generation prompt requires, so every claim keeps its supporting source IDs
-- alongside the prose. sources/research_cards/review_flags are JSONB arrays.
--
-- Apply with the Supabase SQL editor or `supabase db push`.

create extension if not exists "uuid-ossp";

do $$ begin
  create type gene_draft_review_status as enum ('unreviewed', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

create table if not exists gene_page_drafts (
  id                          uuid primary key default uuid_generate_v4(),
  gene_slug                   text not null,
  gene_symbol                 text not null,

  summary_card                jsonb not null,
  what_this_gene_means        jsonb not null,
  how_it_may_affect_vision    jsonb not null,
  what_is_known                jsonb not null,
  what_is_uncertain            jsonb not null,
  what_you_can_do_next         jsonb not null,
  questions_for_clinician      jsonb not null default '[]',
  for_family_and_caregivers    jsonb not null,
  treatment_and_research       jsonb not null,
  clinical_trial_summary       jsonb not null,
  research_cards                jsonb not null default '[]',
  sources                      jsonb not null default '[]',
  review_flags                 jsonb not null default '[]',

  review_status                gene_draft_review_status not null default 'unreviewed',
  generated_at                  timestamptz not null default now(),
  model                         text not null default 'claude-opus-4-8',
  input_tokens                  integer,
  output_tokens                  integer,
  estimated_cost_usd              numeric(10, 4),

  reviewed_by                    text,
  reviewed_at                     timestamptz,
  created_at                       timestamptz not null default now()
);

create index if not exists gene_page_drafts_gene_idx on gene_page_drafts (gene_slug);
create index if not exists gene_page_drafts_status_idx on gene_page_drafts (review_status);

-- Row Level Security: drafts are never public. Only the service-role key
-- (server-only, used by the generation script) can read/write this table.
alter table gene_page_drafts enable row level security;
-- (Intentionally no public select policy — RLS with no policies denies all
--  anon/authenticated access by default; review happens via the Supabase
--  Table Editor or service-role tooling, never the public site.)
