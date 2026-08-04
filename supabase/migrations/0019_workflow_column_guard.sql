-- RP Hope Admin Phase 1 — authorization audit fix #1 (the serious one)
--
-- gpd_update_active_assignee (0003, extended in 0008b) lets an active
-- assignee UPDATE their draft — correct for editing content, but RLS
-- policies only gate ROW visibility, never WHICH COLUMNS or VALUES get
-- written. That policy has no way to stop a reviewer's direct PATCH
-- request (bypassing the app, straight to PostgREST with their own valid
-- JWT) from setting review_status = 'approved' themselves, or forging
-- submitted_at/submitted_by/reviewed_at/reviewed_by/changes_requested_* to
-- fake the workflow history. This is exactly the "reviewer cannot approve
-- through a direct request" case the audit was asked to verify — and it
-- was NOT actually enforced at the database layer before this migration
-- (only by app code never sending those fields, which a direct API call
-- trivially bypasses).
--
-- Fix: a BEFORE UPDATE trigger, since triggers (unlike RLS policies) get
-- real OLD/NEW row access. service_role (every trusted server action here
-- uses it for these exact writes) and admins may change these columns
-- freely; anyone else's direct write must leave them unchanged. This does
-- NOT affect first_opened_at/first_opened_by/last_activity_at (legitimately
-- set by a reviewer's own RLS-scoped write — see lib/reviewer/data.ts and
-- saveDraftAction) or ordinary content columns.
--
-- Apply in the Supabase SQL editor after 0018.

create or replace function public.enforce_gene_draft_workflow_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- service_role: every workflow-transition server action (submit,
  -- request changes, approve, publish) writes through the service-role
  -- client after re-checking authorization itself — always allowed.
  if current_user = 'service_role' or public.auth_is_admin() then
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

drop trigger if exists gpd_workflow_columns_guard on gene_page_drafts;
create trigger gpd_workflow_columns_guard
  before update on gene_page_drafts
  for each row execute function public.enforce_gene_draft_workflow_columns();
