-- RP Hope Admin Phase 1 — schema additions
-- PART 2 — run after 0017 has committed as its own separate execution.
--
-- reviewer_profiles: professional info + invitation/activity tracking, so
-- the Reviewers page can show real invitation state and last-active time
-- instead of raw booleans.
alter table reviewer_profiles add column if not exists title text;
alter table reviewer_profiles add column if not exists organization text;
alter table reviewer_profiles add column if not exists specialty text;
alter table reviewer_profiles add column if not exists admin_notes text;
alter table reviewer_profiles add column if not exists invited_at timestamptz;
alter table reviewer_profiles add column if not exists invited_by uuid references auth.users (id);
alter table reviewer_profiles add column if not exists last_active_at timestamptz;

-- gene_page_drafts: meaningful-access tracking for the assigned→in_progress
-- transition (first_opened_at set exactly once), and ongoing activity for
-- "last reviewer activity" displays. reviewed_at/reviewed_by (0002) already
-- serve as approved_at/approved_by — publish_gene_version sets them when a
-- draft is approved, so no separate approved_at/by columns are needed.
alter table gene_page_drafts add column if not exists first_opened_at timestamptz;
alter table gene_page_drafts add column if not exists first_opened_by uuid references auth.users (id);
alter table gene_page_drafts add column if not exists last_activity_at timestamptz;

-- gene_page_versions: who/when a published version was taken down, and a
-- link back to the version it replaced — the version-history foundation
-- the spec asks for (current published / previous published traceable
-- without a separate "current pointer" table, since exactly one row per
-- gene_slug has status = 'published' at a time already).
alter table gene_page_versions add column if not exists unpublished_at timestamptz;
alter table gene_page_versions add column if not exists unpublished_by uuid references auth.users (id);
alter table gene_page_versions add column if not exists replaces_version_id uuid references gene_page_versions (id);

create index if not exists gene_page_drafts_last_activity_idx on gene_page_drafts (last_activity_at);
create index if not exists reviewer_profiles_last_active_idx on reviewer_profiles (last_active_at);

-- A reassigned-away assignment is no longer "active" for edit/read-active
-- purposes — redefine the two helper functions to also exclude it (CREATE
-- OR REPLACE, same pattern as 0013, safe to re-run).
create or replace function public.auth_is_active_assignee(d uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.draft_assignments a
    join public.reviewer_profiles p on p.user_id = a.reviewer_id
    where a.draft_id = d and a.reviewer_id = auth.uid()
      and a.status not in ('completed', 'reassigned') and p.active
  );
$$;
