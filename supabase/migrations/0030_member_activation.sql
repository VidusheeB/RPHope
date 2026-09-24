-- RP Hope Team Portal — record when a member actually finishes setting up
--
-- THE BUG THIS FIXES
-- ------------------
-- "Has this person completed their invitation?" was inferred from
-- auth.users.last_sign_in_at. That field means something different: clicking
-- an invitation link VERIFIES the token and signs the person in, so
-- last_sign_in_at is stamped the moment they open the email — whether or not
-- they ever chose a password.
--
-- Observed in production: two invited accounts had last_sign_in_at set 18 and
-- 22 seconds after invited_at, purely from opening the link. Consequences:
--
--   * My Team showed them as "Active" when they had never set a password and
--     could not sign in at all.
--   * "Request a new link" silently did nothing, because the request action
--     skips anyone who appears already set up.
--   * Re-inviting them would have been refused as "already an active
--     reviewer".
--
-- So activation is now recorded explicitly, by us, when a password is actually
-- set — rather than inferred from a field that answers a different question.
--
-- Apply in the Supabase SQL editor. Safe to re-run.

alter table reviewer_profiles add column if not exists activated_at timestamptz;

comment on column reviewer_profiles.activated_at is
  'When this member completed their invitation by setting a password. NULL means still invited. Deliberately NOT derived from auth.users.last_sign_in_at, which is stamped merely by opening an invitation link.';

-- Backfill for accounts that predate this column.
--
-- auth.users.encrypted_password is the ground truth for "has a password", and
-- is reachable here even though it is not exposed over the REST API. Anyone
-- holding one has genuinely completed setup, so they are marked activated at
-- their last sign-in; anyone without one stays NULL and correctly reads as
-- still invited. This is what distinguishes a real member from someone who
-- only ever clicked the link.
update reviewer_profiles p
   set activated_at = coalesce(u.last_sign_in_at, u.created_at)
  from auth.users u
 where u.id = p.user_id
   and p.activated_at is null
   and u.encrypted_password is not null
   and u.encrypted_password <> '';

create index if not exists reviewer_profiles_activated_idx on reviewer_profiles (activated_at);
