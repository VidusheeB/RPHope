-- RP Hope — add an "archived" story status so a published story can be
-- taken down without deleting it or mislabeling it "rejected" (rejected
-- implies it was never approved; archived means it WAS live and now isn't
-- — mirrors gene_page_versions' published/archived pair).
--
-- Enum-add only, per Postgres's rule that a new enum value can't be used in
-- the same transaction that adds it — nothing in this file consumes it.
--
-- Apply in the Supabase SQL editor after 0014.

alter type story_status add value if not exists 'archived';
