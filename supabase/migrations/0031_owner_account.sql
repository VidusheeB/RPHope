-- RP Hope Team Portal — the owner account
--
-- Carin runs RP Hope. Her account must not be deactivatable from inside the
-- product by anyone, including another administrator and including herself.
-- Removing it should require someone with database access deliberately
-- clearing this flag first — which is a different kind of act from clicking a
-- button, and that difference is the point.
--
-- WHY A FLAG AND NOT A THIRD ROLE
-- -------------------------------
-- "Owner" is not a different set of permissions — Carin can do exactly what an
-- admin can do. It is a protection on one account. Modelling it as a role
-- would add a tier to the capability table that grants nothing, and every
-- future role question would have to reason about it for no benefit. The spec
-- asks for an owner concept without exposing superadmin complexity in normal
-- UI, and a boolean does that.
--
-- Nothing in the application writes this column. It is set here and changed
-- only in SQL, on purpose: a protection that the product can switch off is not
-- a protection.
--
-- Apply in the Supabase SQL editor. Safe to re-run.

alter table reviewer_profiles add column if not exists is_owner boolean not null default false;

comment on column reviewer_profiles.is_owner is
  'The founding/owner account. Cannot be deactivated through the portal by anyone. Set and cleared only in SQL — no application code writes this column.';

-- Mark the owner. Matched by email so this migration is readable and
-- re-runnable rather than depending on a UUID copied by hand.
update reviewer_profiles p
   set is_owner = true
  from auth.users u
 where u.id = p.user_id
   and lower(u.email) = 'carin.elam@rphope.org';

-- Safety net at the database level, not just in application code. Even a
-- direct PostgREST call with the service-role key cannot deactivate the owner;
-- it has to go through SQL that clears is_owner first.
create or replace function public.protect_owner_account()
returns trigger language plpgsql as $$
begin
  -- Only blocks DEACTIVATION. Everything else about the account — name, notes,
  -- last_active_at — stays editable, and clearing is_owner itself is still
  -- allowed so the protection can be lifted deliberately in SQL.
  if old.is_owner and new.is_owner and old.active and not new.active then
    raise exception 'The RP Hope owner account cannot be deactivated. Clear is_owner first if this is really intended.';
  end if;
  return new;
end;
$$;

drop trigger if exists reviewer_profiles_protect_owner on reviewer_profiles;
create trigger reviewer_profiles_protect_owner
  before update on reviewer_profiles
  for each row execute function public.protect_owner_account();
