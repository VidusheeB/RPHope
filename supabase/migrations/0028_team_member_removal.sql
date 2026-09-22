-- RP Hope Team Portal — permanent removal of a team member
--
-- WHY NOT AN ACTUAL DELETE
-- ------------------------
-- Two things make `delete from auth.users` the wrong operation here:
--
--   1. reviewer_profiles.user_id is `on delete cascade` (0003), so deleting
--      the auth user deletes the profile — and the profile row is how every
--      historical attribution resolves a name. "Jackie approved RPGR" would
--      become a bare UUID across the audit log, gene versions and ticket
--      threads.
--   2. audit_log.actor references auth.users with no ON DELETE action, so the
--      delete would be REFUSED outright for anyone who has actually done work
--      — i.e. exactly the people an admin might want to remove.
--
-- The spec anticipates this: "If actual database deletion conflicts with
-- auditability, use a removed state rather than physically deleting the user."
--
-- So removal is permanent loss of ACCESS, not erasure of history. The account
-- is banned at the auth provider (it can never sign in again), the profile is
-- marked removed and drops off the roster, and every record they touched keeps
-- their name on it.
--
-- Apply in the Supabase SQL editor. Safe to re-run.

alter table reviewer_profiles add column if not exists removed_at timestamptz;
alter table reviewer_profiles add column if not exists removed_by uuid references auth.users (id);

comment on column reviewer_profiles.removed_at is
  'Set when a team member is permanently removed. Distinct from active=false (a temporary deactivation that can be undone): a removed member is banned at the auth provider and does not appear on the roster, but their profile row is retained so historical attribution keeps resolving to a name.';

create index if not exists reviewer_profiles_removed_idx on reviewer_profiles (removed_at);

-- getReviewerSession() already refuses a profile with active = false, and
-- removal always sets active = false too, so a removed member cannot hold a
-- session even if the provider-level ban were ever lifted. Belt and braces:
-- the two independent gates fail the same way.
