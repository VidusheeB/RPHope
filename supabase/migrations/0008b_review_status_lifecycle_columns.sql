-- RP Hope — review status lifecycle (reviewer submits, admin publishes)
-- PART 2 of 2 — run this AFTER 0008_review_status_lifecycle.sql has been
-- run and committed as its own separate execution (see that file's header
-- for why: this file uses the enum values 0008 adds, which Postgres
-- forbids inside the same transaction that added them).
--
-- Apply in the Supabase SQL editor, as its own separate execution, right
-- after 0008.

alter table gene_page_drafts add column if not exists submitted_at timestamptz;
alter table gene_page_drafts add column if not exists submitted_by uuid references auth.users (id);
alter table gene_page_drafts add column if not exists changes_requested_note text;
alter table gene_page_drafts add column if not exists changes_requested_at timestamptz;
alter table gene_page_drafts add column if not exists changes_requested_by uuid references auth.users (id);

-- A submitted draft becomes read-only for the reviewer (not for admins) —
-- extends the existing active-assignee update policy from 0003 rather than
-- replacing it.
drop policy if exists gpd_update_active_assignee on gene_page_drafts;
create policy gpd_update_active_assignee on gene_page_drafts
  for update using (
    (auth_is_active_assignee(id) and review_status not in ('submitted_for_approval', 'approved'))
    or auth_is_admin()
  )
  with check (
    (auth_is_active_assignee(id) and review_status not in ('submitted_for_approval', 'approved'))
    or auth_is_admin()
  );
