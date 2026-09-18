-- RP Hope Team Portal — Opus gene-generation job queue
--
-- WHY A QUEUE AND NOT A DIRECT CALL
-- ---------------------------------
-- Generating one gene page is a multi-minute operation (NCBI verification,
-- PubMed/EuropePMC/ELink retrieval, ClinicalTrials.gov, then one Opus call).
-- A 38-gene "Run All" cannot live inside a single request, and the spec is
-- explicit that generation must survive the admin navigating away or closing
-- the tab. So the browser never runs generation: it enqueues rows here, and a
-- server-side worker drains them.
--
-- This table is also the shared state that makes multi-admin operation work.
-- Every admin reads the same queue, so one admin starting a run is
-- immediately visible to the others rather than being private to their tab.
--
-- Apply in the Supabase SQL editor. Safe to re-run.

create extension if not exists "uuid-ossp";

do $$ begin
  create type gene_generation_status as enum ('queued', 'running', 'complete', 'failed');
exception when duplicate_object then null;
end $$;

create table if not exists gene_generation_jobs (
  id             uuid primary key default uuid_generate_v4(),
  gene_slug      text not null,
  gene_symbol    text not null,
  status         gene_generation_status not null default 'queued',

  -- Who asked for it, and which "Run Selected"/"Run All" press it belongs to,
  -- so the UI can show batch progress ("12 of 38 complete") without guessing.
  requested_by   uuid references auth.users (id),
  batch_id       uuid,

  attempts       int not null default 0,
  error          text,          -- operator-facing failure reason (see note below)
  draft_id       uuid references gene_page_drafts (id) on delete set null,

  queued_at      timestamptz not null default now(),
  started_at     timestamptz,
  finished_at    timestamptz,
  -- Touched while a job runs so a crashed worker's job can be detected and
  -- requeued instead of being stuck on 'running' forever.
  heartbeat_at   timestamptz
);

create index if not exists gene_generation_jobs_status_idx on gene_generation_jobs (status);
create index if not exists gene_generation_jobs_batch_idx  on gene_generation_jobs (batch_id);
create index if not exists gene_generation_jobs_gene_idx   on gene_generation_jobs (gene_slug);
create index if not exists gene_generation_jobs_queued_idx on gene_generation_jobs (queued_at);

-- ---------------------------------------------------------------------------
-- DUPLICATE PREVENTION — the important part.
--
-- The spec requires that a gene already queued/running cannot receive a second
-- job, and that this must NOT rely on a disabled button: two tabs, two admins,
-- a double-click, or stale frontend state must all be rejected. A partial
-- unique index makes that a database invariant — the second INSERT fails with
-- a unique violation no matter how it arrived, and there is no read-then-write
-- race window the way a "select count then insert" check would have.
--
-- Scoped to the ACTIVE states only, so a gene can legitimately be re-run after
-- a previous job completed or failed (retry).
-- ---------------------------------------------------------------------------
create unique index if not exists gene_generation_jobs_one_active_per_gene
  on gene_generation_jobs (gene_slug)
  where status in ('queued', 'running');

-- ---------------------------------------------------------------------------
-- Atomic claim. FOR UPDATE SKIP LOCKED is what lets several worker
-- invocations drain the queue at once without two of them grabbing the same
-- job: each skips rows another transaction has locked rather than blocking on
-- them. Returns the claimed row, or nothing when the queue is empty.
-- ---------------------------------------------------------------------------
create or replace function public.claim_next_generation_job(worker_stale_seconds int default 600)
returns setof public.gene_generation_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Requeue jobs whose worker died mid-flight (no heartbeat for a while), so
  -- a crashed invocation can't strand a gene on 'running' permanently.
  update public.gene_generation_jobs
     set status = 'queued', started_at = null, heartbeat_at = null
   where status = 'running'
     and heartbeat_at is not null
     and heartbeat_at < now() - make_interval(secs => worker_stale_seconds);

  return query
  update public.gene_generation_jobs j
     set status = 'running',
         started_at = now(),
         heartbeat_at = now(),
         attempts = j.attempts + 1
   where j.id = (
     select c.id
       from public.gene_generation_jobs c
      where c.status = 'queued'
      order by c.queued_at
      limit 1
      for update skip locked
   )
  returning j.*;
end;
$$;

revoke execute on function public.claim_next_generation_job(int) from public;
revoke execute on function public.claim_next_generation_job(int) from anon, authenticated;
grant  execute on function public.claim_next_generation_job(int) to service_role;

-- RLS: deny-all for anon/authenticated. Every read and write goes through the
-- service-role client behind a genes.generate / genes.view_all capability
-- check, matching how audit_log is handled (0012).
alter table gene_generation_jobs enable row level security;

-- Note on `error`: store a short operator-facing reason only. Model traces and
-- stack dumps do not belong here — the spec asks for a friendly failure with
-- optional detail, not a wall of text in the queue UI.
