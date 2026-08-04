-- RP Hope Admin Phase 1 — a private admin note per gene draft
--
-- Distinct from reviewer_profiles.admin_notes (private notes ABOUT a
-- reviewer person) and from review_flag_resolutions.reviewer_note (a
-- reviewer's note on one specific AI flag) — this is a free-form admin-only
-- note about THIS gene's review as a whole, shown on the unified gene
-- detail page. Never rendered publicly.
--
-- Apply in the Supabase SQL editor after 0017b.

alter table gene_page_drafts add column if not exists admin_note text;
