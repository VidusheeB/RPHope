-- RP Hope Admin Phase 1 — attribute content edits to whoever actually made
-- them (spec: "Admin edit is attributed to admin... must not attribute
-- changes to the reviewer"). Nothing previously tracked WHO last edited a
-- draft's narrative content — only workflow-transition actors (submitted_by,
-- reviewed_by, etc.) were tracked. saveDraftAction now stamps this on every
-- meaningful save, whether the caller is the assigned reviewer or an admin.
--
-- Apply in the Supabase SQL editor after 0020.

alter table gene_page_drafts add column if not exists last_edited_by uuid references auth.users (id);
