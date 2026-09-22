-- RP Hope Team Portal — preserve the EXACT version a reviewer approved
--
-- THE PROBLEM
-- -----------
-- publishAction() published the `content` its caller posted, and the only
-- record of "what was approved" was the live gene_page_drafts row. Two ways
-- that goes wrong:
--
--   1. The RLS lock added in 0008 stops the REVIEWER editing a submitted
--      draft, but admins are explicitly exempt from it. So an admin could
--      edit a draft after a reviewer approved it and then publish, and the
--      published page would not be what the reviewer signed off on — with
--      nothing anywhere recording the difference.
--   2. The content came from the browser. Whatever the admin's editor happened
--      to be holding is what got written.
--
-- On a site whose whole governance model is "a human reviewed this medical
-- claim", publishing something other than the reviewed text is the one failure
-- that matters most. The spec calls this out directly: the approved version
-- must be preserved and must be what publication makes live.
--
-- THE FIX
-- -------
-- Snapshot the content at the moment the reviewer submits. From then on,
-- publication reads the snapshot from the database and ignores whatever the
-- client sends. Later edits to the draft cannot silently change what an
-- administrator is about to publish — they would have to send it back for
-- changes, which produces a fresh review and a fresh snapshot.
--
-- Nullable because every EXISTING draft predates this column. Publication
-- falls back to the live draft row when it is null, so nothing already in
-- flight breaks; new submissions always populate it.
--
-- Apply in the Supabase SQL editor. Safe to re-run.

alter table gene_page_drafts
  add column if not exists submitted_content jsonb;

comment on column gene_page_drafts.submitted_content is
  'Immutable snapshot of the draft content at the moment the reviewer submitted it for approval. Publication publishes THIS, not the live row, so an edit after approval cannot silently change what goes live. Null only for drafts submitted before this column existed.';

-- The workflow-column guard from 0019/0023 already restricts review_status and
-- the workflow timestamps to trusted server paths. Add the snapshot to that
-- protected set: it is written by the submit action and must never be editable
-- through an ordinary draft-content update, or the guarantee above is void.
create or replace function public.enforce_gene_draft_workflow_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Trusted server paths (service_role) perform every workflow transition
  -- after re-checking authorization in application code. Anything else — a
  -- reviewer's RLS-scoped client using their own JWT — may not touch these.
  if current_setting('request.jwt.claim.role', true) = 'service_role'
     or current_setting('role', true) = 'service_role' then
    return new;
  end if;

  if new.review_status is distinct from old.review_status
     or new.reviewed_at is distinct from old.reviewed_at
     or new.reviewed_by is distinct from old.reviewed_by
     or new.submitted_at is distinct from old.submitted_at
     or new.submitted_by is distinct from old.submitted_by
     or new.submitted_content is distinct from old.submitted_content
     or new.changes_requested_at is distinct from old.changes_requested_at
     or new.changes_requested_by is distinct from old.changes_requested_by
     or new.changes_requested_note is distinct from old.changes_requested_note then
    raise exception 'review_status and workflow timestamps can only change through the review workflow actions';
  end if;

  return new;
end;
$$;

drop trigger if exists gpd_workflow_columns_guard on gene_page_drafts;
create trigger gpd_workflow_columns_guard
  before update on gene_page_drafts
  for each row execute function public.enforce_gene_draft_workflow_columns();
