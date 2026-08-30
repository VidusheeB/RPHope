-- Fixes a live bug in 0019's workflow-column guard.
--
-- 0019 allows the write when `current_user = 'service_role'`. That check can
-- never be true: the guard is declared SECURITY DEFINER, and inside a SECURITY
-- DEFINER function current_user is the function's OWNER (postgres), not the
-- role that made the request. So the intended service-role escape hatch never
-- opened, and the guard rejected EVERY workflow write — including the trusted
-- server actions it was explicitly written to allow.
--
-- Observed effect: with 0019 applied, a service-role update touching
-- review_status / reviewed_at / reviewed_by / submitted_* / changes_requested_*
-- fails with "review_status and workflow timestamps can only change through the
-- review workflow actions". That breaks approveReviewAction, submitReviewAction,
-- requestChangesAction, and the draft update inside publish_gene_version.
-- Reproduced directly against the database before writing this migration.
--
-- Fix: detect the REQUESTING role from the PostgREST JWT claims, which
-- current_setting exposes regardless of SECURITY DEFINER, and keep session_user
-- and current_user as belt-and-braces for non-PostgREST callers (psql, the SQL
-- editor, migrations).
--
-- The guard's actual purpose is unchanged: a reviewer PATCHing PostgREST
-- directly with their own JWT still cannot approve themselves or forge the
-- workflow history.
--
-- Apply in the Supabase SQL editor after 0022.

create or replace function public.request_role()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_claims text;
begin
  -- Present for PostgREST requests; absent in psql / the SQL editor.
  v_claims := current_setting('request.jwt.claims', true);
  if v_claims is null or v_claims = '' then
    return null;
  end if;
  return (v_claims::jsonb) ->> 'role';
exception
  when others then
    return null; -- malformed claims must not break the write path
end;
$$;

create or replace function public.enforce_gene_draft_workflow_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Trusted server paths: every workflow-transition server action re-checks
  -- authorization itself and then writes through the service-role client.
  -- session_user/current_user cover direct database connections (migrations,
  -- the SQL editor) where there are no JWT claims to read.
  if public.request_role() = 'service_role'
     or session_user in ('service_role', 'postgres', 'supabase_admin')
     or current_user in ('service_role', 'postgres', 'supabase_admin')
     or public.auth_is_admin()
  then
    return new;
  end if;

  if new.review_status is distinct from old.review_status
    or new.submitted_at is distinct from old.submitted_at
    or new.submitted_by is distinct from old.submitted_by
    or new.changes_requested_note is distinct from old.changes_requested_note
    or new.changes_requested_at is distinct from old.changes_requested_at
    or new.changes_requested_by is distinct from old.changes_requested_by
    or new.reviewed_at is distinct from old.reviewed_at
    or new.reviewed_by is distinct from old.reviewed_by
  then
    raise exception 'review_status and workflow timestamps can only change through the review workflow actions';
  end if;

  return new;
end;
$$;
