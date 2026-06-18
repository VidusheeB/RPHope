-- RP Hope — gene library schema (draft)
--
-- Mirrors the gene data model in CLAUDE.md. This is the forward-looking "build it
-- right" schema: inheritance_pattern and disease_category are SEPARATE columns
-- (the live Wix site stores the inheritance pattern under a field Carin labels
-- "Disease Category" — keep them distinct here so filtering/comparison work).
--
-- Apply with the Supabase SQL editor or `supabase db push` once the project exists.

create extension if not exists "uuid-ossp";

-- Content review workflow (see CLAUDE.md → Content governance).
do $$ begin
  create type gene_status as enum ('draft', 'pending_review', 'published');
exception when duplicate_object then null;
end $$;

create table if not exists genes (
  id                    uuid primary key default uuid_generate_v4(),
  slug                  text unique not null,           -- e.g. "inpp5e"
  gene_name             text not null,                  -- e.g. "INPP5E"
  full_name             text,                           -- e.g. "Inositol polyphosphate-5-phosphatase E"
  aliases               text[] default '{}',

  inheritance_pattern   text,                           -- autosomal recessive / dominant / X-linked  (SEPARATE field)
  disease_category      text,                           -- e.g. retinal ciliopathy                    (SEPARATE field)
  mechanism             text,

  patient_population     text,
  plain_english_summary text,                           -- written for non-medical readers (shown first)
  technical_summary      text,                           -- deeper science (expandable)
  treatment_status       text,
  eye_health_strategies  text,
  clinical_trial_status  text,                           -- text + link to ClinicalTrials.gov

  research_institutions  text[] default '{}',
  research_items         jsonb default '[]',             -- [{ date, title, why_it_matters, source_url }]
  sources                jsonb default '[]',             -- [{ citation, url, paraphrased }]

  last_reviewed_date     date,
  reviewer               text,

  status                 gene_status not null default 'pending_review',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Full-text search over the searchable fields (powers the gene library search).
-- Full-text search vector, maintained by a TRIGGER (not a generated column).
-- A generated column rejects to_tsvector here because the text→regconfig config
-- lookup isn't immutable ("generation expression is not immutable"). A trigger has
-- no immutability requirement, so this is the portable, always-works approach.
alter table genes add column if not exists search_tsv tsvector;

create or replace function genes_search_tsv_refresh()
returns trigger language plpgsql as $$
begin
  new.search_tsv :=
    to_tsvector('english',
      coalesce(new.gene_name, '') || ' ' ||
      coalesce(new.full_name, '') || ' ' ||
      array_to_string(coalesce(new.aliases, '{}'), ' ') || ' ' ||
      coalesce(new.plain_english_summary, '') || ' ' ||
      coalesce(new.disease_category, '') || ' ' ||
      coalesce(new.inheritance_pattern, ''));
  return new;
end;
$$;

drop trigger if exists genes_search_tsv_trigger on genes;
create trigger genes_search_tsv_trigger
  before insert or update on genes
  for each row execute function genes_search_tsv_refresh();

create index if not exists genes_search_idx on genes using gin (search_tsv);
create index if not exists genes_status_idx on genes (status);
create index if not exists genes_inheritance_idx on genes (inheritance_pattern);
create index if not exists genes_category_idx on genes (disease_category);

-- Row Level Security: the public site only ever reads PUBLISHED genes.
alter table genes enable row level security;

drop policy if exists "public reads published genes" on genes;
create policy "public reads published genes"
  on genes for select
  using (status = 'published');

-- (Admin/editor write policies are added when auth is wired up.)
