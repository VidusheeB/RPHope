-- RP Hope Admin Phase 1 — notification deduplication
--
-- notify() previously did an unconditional insert every time it was called,
-- with no idempotency protection — a double-click, a retried server action,
-- or a caller invoked twice for the same underlying event would create
-- duplicate rows in the same recipient's inbox. Adding a per-notification
-- dedupe_key (e.g. "review:{draftId}:submitted:{submittedAt}") that's
-- UNIQUE per recipient, so a second insert attempt for the same real-world
-- event is a no-op instead of a duplicate row.
--
-- Nullable: not every notification needs one (a unique index on a nullable
-- column allows any number of NULLs — only rows that actually supply a key
-- get uniqueness enforced), so this is additive and safe for existing rows.
--
-- Apply in the Supabase SQL editor after 0015.

alter table notifications add column if not exists dedupe_key text;

create unique index if not exists notifications_recipient_dedupe_idx
  on notifications (recipient, dedupe_key)
  where dedupe_key is not null;
