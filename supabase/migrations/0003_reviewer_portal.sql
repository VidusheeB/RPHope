-- RP Hope — Reviewer portal (invite-only Supabase Auth + RLS)
--
-- Adds the tables and Row Level Security that let vetted human reviewers log in
-- ON THE RP HOPE WEBSITE (never the Supabase dashboard) and resolve the AI
-- review flags on gene-page drafts assigned to them, then approve & publish an
-- immutable public version. Governance (CLAUDE.md): AI drafts, humans review;
-- nothing is public until a reviewer with publishing permission approves it.
--
-- SECURITY MODEL
--  * Browser talks to Supabase with the ANON key + the reviewer's JWT only;
--    every table below is protected by RLS so a reviewer can reach ONLY the
--    drafts assigned to them. The service-role key is server-only.
--  * Role / can_publish live in reviewer_profiles and are checked by RLS and,
--    again, inside the publish server action — never trusted from the client.
--  * Publishing (archiving the old version + writing a new immutable one) is a
--    privileged server action performed with the service-role client AFTER it
--    re-verifies authorization; reviewers cannot write gene_page_versions
--    directly, so RLS gives them no publish path outside the vetted action.
--
-- Apply in the Supabase SQL editor (after 0002_gene_page_drafts.sql).

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- reviewer_profiles: one row per Supabase Auth user who may use the portal.
-- ---------------------------------------------------------------------------
do $$ begin
  create type reviewer_role as enum ('reviewer', 'admin');
exception when duplicate_object then null;
end $$;

create table if not exists reviewer_profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  role         reviewer_role not null default 'reviewer',
  can_publish  boolean not null default false,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- draft_assignments: the SOURCE OF TRUTH for which reviewer may touch which
-- draft. (Deliberately NOT a column on gene_page_drafts.)
-- ---------------------------------------------------------------------------
do $$ begin
  create type assignment_status as enum ('assigned', 'in_progress', 'completed');
exception when duplicate_object then null;
end $$;

create table if not exists draft_assignments (
  id           uuid primary key default uuid_generate_v4(),
  draft_id     uuid not null references gene_page_drafts (id) on delete cascade,
  reviewer_id  uuid not null references auth.users (id) on delete cascade,
  assigned_by  uuid references auth.users (id),
  assigned_at  timestamptz not null default now(),
  completed_at timestamptz,
  status       assignment_status not null default 'assigned',
  unique (draft_id, reviewer_id)
);
create index if not exists draft_assignments_reviewer_idx on draft_assignments (reviewer_id);
create index if not exists draft_assignments_draft_idx on draft_assignments (draft_id);

-- ---------------------------------------------------------------------------
-- review_flag_resolutions: reviewer's resolution of each AI review flag. The
-- ORIGINAL flag text is copied here immutably for audit; the source
-- gene_page_drafts.review_flags array is never modified.
-- ---------------------------------------------------------------------------
do $$ begin
  create type flag_resolution_status as enum (
    'unresolved', 'wording_confirmed', 'edited_and_resolved', 'not_applicable'
  );
exception when duplicate_object then null;
end $$;

create table if not exists review_flag_resolutions (
  id                 uuid primary key default uuid_generate_v4(),
  draft_id           uuid not null references gene_page_drafts (id) on delete cascade,
  flag_index         integer not null,
  original_flag_text text not null,
  status             flag_resolution_status not null default 'unresolved',
  reviewer_note      text,
  section_affected   text,
  resolved_by        uuid references auth.users (id),
  resolved_at        timestamptz,
  unique (draft_id, flag_index)
);
create index if not exists flag_resolutions_draft_idx on review_flag_resolutions (draft_id);

-- ---------------------------------------------------------------------------
-- gene_page_versions: immutable published/archived snapshots. The public gene
-- page reads the newest `published` row for a slug; publishing archives the
-- previous published row and inserts a new one. Never edited in place.
-- ---------------------------------------------------------------------------
do $$ begin
  create type gene_version_status as enum ('published', 'archived');
exception when duplicate_object then null;
end $$;

create table if not exists gene_page_versions (
  id              uuid primary key default uuid_generate_v4(),
  gene_slug       text not null,
  version_number  integer not null,
  content         jsonb not null,
  status          gene_version_status not null default 'published',
  source_draft_id uuid references gene_page_drafts (id),
  approved_by     uuid references auth.users (id),
  approved_at     timestamptz,
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  unique (gene_slug, version_number)
);
-- At most one published version per gene at a time (archive-then-insert).
create unique index if not exists gene_versions_one_published_idx
  on gene_page_versions (gene_slug) where status = 'published';

-- ---------------------------------------------------------------------------
-- Authorization helper functions (SECURITY DEFINER so policies can consult
-- reviewer_profiles / draft_assignments without the calling user needing
-- direct select rights on them — avoids RLS recursion).
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER hardening (all three helpers):
--   * explicit EMPTY search_path (set search_path = '') so nothing resolves
--     from a caller-controlled schema; every table/function is schema-qualified
--     (public.*, auth.uid());
--   * STABLE (read-only, no side effects);
--   * they key off auth.uid() ONLY — never a caller-supplied user id — so a
--     caller can learn only their OWN admin/assignment status, never another
--     user's role, assignment, or permissions;
--   * EXECUTE is revoked from PUBLIC and granted only to `authenticated` (RLS
--     policies evaluate these as the querying user, who is authenticated).
create or replace function public.auth_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.reviewer_profiles
    where user_id = auth.uid() and role = 'admin' and active
  );
$$;

create or replace function public.auth_is_assigned(d uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.draft_assignments
    where draft_id = d and reviewer_id = auth.uid()
  );
$$;

-- Assigned AND the assignment is still active (not completed) — the edit gate.
create or replace function public.auth_is_active_assignee(d uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.draft_assignments
    where draft_id = d and reviewer_id = auth.uid() and status <> 'completed'
  );
$$;

revoke execute on function public.auth_is_admin() from public;
revoke execute on function public.auth_is_assigned(uuid) from public;
revoke execute on function public.auth_is_active_assignee(uuid) from public;
grant execute on function public.auth_is_admin() to authenticated;
grant execute on function public.auth_is_assigned(uuid) to authenticated;
grant execute on function public.auth_is_active_assignee(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table reviewer_profiles       enable row level security;
alter table draft_assignments       enable row level security;
alter table review_flag_resolutions enable row level security;
alter table gene_page_versions      enable row level security;

-- reviewer_profiles: a user reads their OWN profile; admins read all. Only
-- admins insert/update/delete (a reviewer can never elevate their own role or
-- can_publish — there is no self-update policy).
drop policy if exists rp_select_own_or_admin on reviewer_profiles;
create policy rp_select_own_or_admin on reviewer_profiles
  for select using (user_id = auth.uid() or auth_is_admin());
drop policy if exists rp_admin_write on reviewer_profiles;
create policy rp_admin_write on reviewer_profiles
  for all using (auth_is_admin()) with check (auth_is_admin());

-- draft_assignments: reviewer reads their own; admins read all. Only admins
-- create/modify assignments (reviewers may not modify assignments).
drop policy if exists da_select on draft_assignments;
create policy da_select on draft_assignments
  for select using (reviewer_id = auth.uid() or auth_is_admin());
drop policy if exists da_admin_write on draft_assignments;
create policy da_admin_write on draft_assignments
  for all using (auth_is_admin()) with check (auth_is_admin());

-- gene_page_drafts: reviewers read a draft only if assigned; admins read all;
-- reviewers may UPDATE an assigned, still-active draft (edit its sections). No
-- delete. (Table already had RLS enabled with no policies from 0002 — these
-- are the first policies, so anon/public still get nothing.)
drop policy if exists gpd_select_assigned on gene_page_drafts;
create policy gpd_select_assigned on gene_page_drafts
  for select using (auth_is_assigned(id) or auth_is_admin());
drop policy if exists gpd_update_active_assignee on gene_page_drafts;
create policy gpd_update_active_assignee on gene_page_drafts
  for update using (auth_is_active_assignee(id) or auth_is_admin())
  with check (auth_is_active_assignee(id) or auth_is_admin());

-- review_flag_resolutions: reviewer reads/writes resolutions for drafts
-- assigned to them; resolved_by must be themselves. Admins full access.
drop policy if exists rfr_select on review_flag_resolutions;
create policy rfr_select on review_flag_resolutions
  for select using (auth_is_assigned(draft_id) or auth_is_admin());
drop policy if exists rfr_insert on review_flag_resolutions;
create policy rfr_insert on review_flag_resolutions
  for insert with check (
    (auth_is_active_assignee(draft_id) and (resolved_by is null or resolved_by = auth.uid()))
    or auth_is_admin()
  );
drop policy if exists rfr_update on review_flag_resolutions;
create policy rfr_update on review_flag_resolutions
  for update using (auth_is_active_assignee(draft_id) or auth_is_admin())
  with check (auth_is_active_assignee(draft_id) or auth_is_admin());

-- gene_page_versions: PUBLISHED versions are world-readable (the public gene
-- page reads them with the anon key). No reviewer write path — publishing is a
-- server-only, service-role action that re-checks authorization first, so
-- there is intentionally no insert/update/delete policy here.
drop policy if exists gpv_public_read_published on gene_page_versions;
create policy gpv_public_read_published on gene_page_versions
  for select using (status = 'published' or auth_is_admin());

-- ---------------------------------------------------------------------------
-- Atomic publish RPC. Every publish mutation runs in ONE transaction (a
-- plpgsql function is a single transaction context), so a failure rolls back
-- ALL of it — the previously published version is never left archived by a
-- half-completed publish. Concurrency is serialized per-gene by a transaction-
-- scoped advisory lock; combined with the partial unique index
-- (gene_versions_one_published_idx) at most one row per gene is ever
-- 'published'. A double-submit for the SAME draft is idempotent: the second
-- call sees the already-published version from that draft and returns it
-- instead of creating a second version.
--
-- SECURITY: SECURITY DEFINER with an empty search_path and fully schema-
-- qualified references. EXECUTE is revoked from public/anon/authenticated and
-- granted ONLY to service_role — a logged-in reviewer cannot call it directly
-- (they have no publish path outside the server action, which re-authorizes
-- first). Authorization is NOT re-checked inside the function because it is
-- unreachable except via the service-role server action that already verified
-- assignment + can_publish; the grant is the guard.
create or replace function public.publish_gene_version(
  p_draft_id     uuid,
  p_gene_slug    text,
  p_content      jsonb,
  p_approver     uuid,
  p_assignment_id uuid
) returns table (version_id uuid, gene_slug text)
language plpgsql security definer set search_path = '' as $$
declare
  v_next    integer;
  v_new_id  uuid;
  v_existing uuid;
begin
  -- Serialize concurrent publishes for THIS gene until this txn commits.
  perform pg_advisory_xact_lock(hashtext('gene_publish:' || p_gene_slug));

  -- Idempotency / double-submit guard: if this draft already produced the
  -- current published version, return it without creating another.
  select id into v_existing
  from public.gene_page_versions
  where gene_slug = p_gene_slug and status = 'published' and source_draft_id = p_draft_id
  limit 1;
  if v_existing is not null then
    version_id := v_existing;
    gene_slug := p_gene_slug;
    return next;
    return;
  end if;

  -- Archive the current published version (rolled back with everything else on
  -- any later failure in this function).
  update public.gene_page_versions
    set status = 'archived'
    where gene_slug = p_gene_slug and status = 'published';

  select coalesce(max(version_number), 0) + 1 into v_next
    from public.gene_page_versions where gene_slug = p_gene_slug;

  insert into public.gene_page_versions
    (gene_slug, version_number, content, status, source_draft_id, approved_by, approved_at, published_at)
  values
    (p_gene_slug, v_next, p_content, 'published', p_draft_id, p_approver, now(), now())
  returning id into v_new_id;

  update public.gene_page_drafts
    set review_status = 'approved', reviewed_by = p_approver, reviewed_at = now()
    where id = p_draft_id;

  if p_assignment_id is not null then
    update public.draft_assignments
      set status = 'completed', completed_at = now()
      where id = p_assignment_id;
  end if;

  version_id := v_new_id;
  gene_slug := p_gene_slug;
  return next;
end;
$$;

revoke execute on function public.publish_gene_version(uuid, text, jsonb, uuid, uuid) from public;
grant execute on function public.publish_gene_version(uuid, text, jsonb, uuid, uuid) to service_role;
