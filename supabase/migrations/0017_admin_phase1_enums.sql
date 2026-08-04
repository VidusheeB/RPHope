-- RP Hope Admin Phase 1 — new enum value only
-- PART 1 — run this file ALONE, then run 0017b as a SEPARATE execution
-- (same Postgres rule as 0008/0008b: a new enum value can't be used in the
-- same transaction that added it, and the Supabase SQL editor runs a whole
-- pasted script as one transaction).
--
-- 'reassigned' marks a draft_assignments row whose reviewer was replaced by
-- a different reviewer — distinct from 'completed' (which means the
-- reviewer actually finished their work), so reassignment history stays
-- honest: the row is preserved, just no longer active.
--
-- Apply in the Supabase SQL editor after 0016.

alter type assignment_status add value if not exists 'reassigned';
