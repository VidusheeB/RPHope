-- RP Hope — review status lifecycle (reviewer submits, admin publishes)
--
-- Adds the states needed to separate "reviewer is done" from "admin
-- approved it": submitted_for_approval and changes_requested. Postgres
-- enum values can't be used in the same transaction they're added in, so
-- this migration ONLY adds the values — no INSERT/UPDATE using them here.
--
-- Apply in the Supabase SQL editor (after 0007; run this whole file as one
-- script — each ADD VALUE is safe together since none of them are consumed
-- in this same file).

alter type gene_draft_review_status add value if not exists 'submitted_for_approval';
alter type gene_draft_review_status add value if not exists 'changes_requested';

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
