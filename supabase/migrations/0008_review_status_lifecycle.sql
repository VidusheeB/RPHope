-- RP Hope — review status lifecycle (reviewer submits, admin publishes)
-- PART 1 of 2 — run this file ALONE, then run
-- 0008b_review_status_lifecycle_columns.sql as a SEPARATE query.
--
-- Adds the states needed to separate "reviewer is done" from "admin
-- approved it": submitted_for_approval and changes_requested.
--
-- Postgres will not let a newly-added enum value be USED (compared,
-- inserted, cast) inside the same transaction that added it — and the
-- Supabase SQL editor runs an entire pasted script as one transaction. The
-- follow-up file's CREATE POLICY compares gene_page_drafts.review_status
-- against the string 'submitted_for_approval', which implicitly casts it to
-- the enum — that counts as "using" the value. So this file does ONLY the
-- ALTER TYPE statements, and must be committed (i.e. run and finish) before
-- 0008b runs.
--
-- Apply in the Supabase SQL editor after 0007, as its own separate
-- execution.

alter type gene_draft_review_status add value if not exists 'submitted_for_approval';
alter type gene_draft_review_status add value if not exists 'changes_requested';
