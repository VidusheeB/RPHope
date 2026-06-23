-- AI explanation transcript log (governance: review-after-the-fact).
--
-- The voice assistant can generate a live plain-English simplification or an
-- analogy of a gene page's ALREADY-REVIEWED content (see app/api/explain). That
-- output is AI-generated novel text, so — per CLAUDE.md content governance — we
-- log every generation here as `pending_review`. A human periodically reads this
-- queue in the Supabase Table Editor and flags anything inaccurate or
-- distorted; a bad analogy can then be turned into a hard-coded refusal or a
-- pre-written reviewed analogy.
--
-- This table is NOT publicly readable (no RLS policy granting anon access). Only
-- the service role (server) writes to it and only reviewers read it.

create table if not exists public.ai_explanations (
  id           uuid primary key default gen_random_uuid(),
  gene_slug    text not null,
  mode         text not null,                 -- 'simplify' | 'analogy'
  question     text,                           -- what the user asked, verbatim
  source_text  text,                           -- the reviewed text it was grounded in
  explanation  text not null,                  -- the AI output that was spoken
  model        text,
  created_at   timestamptz not null default now(),
  status       text not null default 'pending_review',  -- pending_review | ok | flagged
  reviewed_by  text
);

alter table public.ai_explanations enable row level security;
-- No anon policy on purpose: the public site never reads these rows.
