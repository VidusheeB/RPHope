-- RP Hope — deactivated reviewers lose DATABASE access, not just app access
--
-- Gap found while adding permission tests: auth_is_assigned()/
-- auth_is_active_assignee() (0003_reviewer_portal.sql) only checked that a
-- draft_assignments row exists for auth.uid() — they never checked whether
-- that reviewer's reviewer_profiles.active is still true. The app-layer
-- session.ts already refuses a session for an inactive reviewer
-- (getReviewerSession returns null), which blocks the normal UI path, but a
-- reviewer with a still-valid Supabase Auth session (not yet signed out)
-- could in principle call a server action directly and have RLS allow the
-- read/write anyway, since auth_is_assigned() didn't re-check activity.
--
-- Redefines both functions (CREATE OR REPLACE — safe to re-run, no data
-- migration needed) to also require the calling reviewer to be active.
-- auth_is_admin() already had this check from day one; this brings the
-- other two helpers in line with it.
--
-- Apply in the Supabase SQL editor after 0012.

create or replace function public.auth_is_assigned(d uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.draft_assignments a
    join public.reviewer_profiles p on p.user_id = a.reviewer_id
    where a.draft_id = d and a.reviewer_id = auth.uid() and p.active
  );
$$;

create or replace function public.auth_is_active_assignee(d uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.draft_assignments a
    join public.reviewer_profiles p on p.user_id = a.reviewer_id
    where a.draft_id = d and a.reviewer_id = auth.uid() and a.status <> 'completed' and p.active
  );
$$;
