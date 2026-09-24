-- RP Hope Team Portal — direct messages
--
-- Separate from review_tickets, and deliberately so. A TICKET is raised TO the
-- RP Hope team: every admin can see it, it gets delegated, it gets resolved.
-- A MESSAGE is private correspondence between specific people — only its
-- participants can read it, including admins. Being an administrator of the
-- organisation does not make you a reader of its private conversations.
--
-- Any team member may message any other, in 1:1 or group threads, like texting.
-- Nothing here is role-aware, so a future role (volunteer, etc.) can message
-- and be messaged without touching this schema.
--
-- Apply in the Supabase SQL editor. Safe to re-run.

create extension if not exists "uuid-ossp";

create table if not exists conversations (
  id          uuid primary key default uuid_generate_v4(),
  -- Optional, and only meaningful for groups. A 1:1 thread is titled by who
  -- is in it, the way a text thread is.
  title       text,
  created_by  uuid not null references auth.users (id),
  created_at  timestamptz not null default now(),
  -- Denormalised so the thread list can sort by recent activity without
  -- aggregating messages on every load.
  updated_at  timestamptz not null default now()
);

create table if not exists conversation_participants (
  conversation_id uuid not null references conversations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  added_at        timestamptz not null default now(),
  -- Drives the unread indicator.
  last_read_at    timestamptz,
  primary key (conversation_id, user_id)
);

create table if not exists conversation_messages (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  author          uuid not null references auth.users (id),
  body            text not null,
  created_at      timestamptz not null default now()
);

create index if not exists conversation_participants_user_idx
  on conversation_participants (user_id);
create index if not exists conversation_messages_thread_idx
  on conversation_messages (conversation_id, created_at);
create index if not exists conversations_updated_idx
  on conversations (updated_at desc);

-- ---------------------------------------------------------------------------
-- Participation check.
--
-- MUST be SECURITY DEFINER. The obvious policy on conversation_participants —
-- "you may read a row if you are a participant of that conversation" — has to
-- query conversation_participants to decide, which re-triggers the same policy
-- and fails with infinite recursion. A definer function runs with the owner's
-- rights, so its own lookup is not subject to RLS and the recursion is broken.
--
-- It is safe because it answers exactly one yes/no question about the CALLER
-- (auth.uid() is taken inside, never passed in), so it cannot be used to probe
-- anyone else's membership.
-- ---------------------------------------------------------------------------
create or replace function public.auth_in_conversation(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = c and p.user_id = auth.uid()
  );
$$;

revoke execute on function public.auth_in_conversation(uuid) from public;
grant  execute on function public.auth_in_conversation(uuid) to authenticated;

alter table conversations              enable row level security;
alter table conversation_participants  enable row level security;
alter table conversation_messages      enable row level security;

-- conversations: participants only. NOTE the deliberate absence of an
-- auth_is_admin() escape hatch — unlike tickets, an admin has no privileged
-- read here. That asymmetry is the whole point of the feature.
drop policy if exists conv_select on conversations;
create policy conv_select on conversations
  for select using (auth_in_conversation(id));

drop policy if exists conv_insert on conversations;
create policy conv_insert on conversations
  for insert with check (created_by = auth.uid());

-- Only a participant may rename a group thread.
drop policy if exists conv_update on conversations;
create policy conv_update on conversations
  for update using (auth_in_conversation(id)) with check (auth_in_conversation(id));

-- participants: you can see who else is in a thread you are in.
drop policy if exists convp_select on conversation_participants;
create policy convp_select on conversation_participants
  for select using (auth_in_conversation(conversation_id));

-- Adding people: either you are starting the thread (you are its creator and
-- not yet a participant of it), or you are already in it and adding someone to
-- a group. Both paths require you to be the one doing it.
drop policy if exists convp_insert on conversation_participants;
create policy convp_insert on conversation_participants
  for insert with check (
    auth_in_conversation(conversation_id)
    or exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.created_by = auth.uid()
    )
  );

-- Leaving a thread removes only your OWN row; you cannot remove someone else.
drop policy if exists convp_delete on conversation_participants;
create policy convp_delete on conversation_participants
  for delete using (user_id = auth.uid());

-- Marking your own row read.
drop policy if exists convp_update_self on conversation_participants;
create policy convp_update_self on conversation_participants
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- messages: readable by participants, written only as yourself.
drop policy if exists convm_select on conversation_messages;
create policy convm_select on conversation_messages
  for select using (auth_in_conversation(conversation_id));

drop policy if exists convm_insert on conversation_messages;
create policy convm_insert on conversation_messages
  for insert with check (
    author = auth.uid() and auth_in_conversation(conversation_id)
  );

-- Messages are deliberately immutable: no update or delete policy. Editing
-- what you said after someone has read it is not a property of a message
-- thread, and silently rewriting history in a medical organisation's internal
-- record is worse than leaving a correction in the thread.

-- Keep conversations.updated_at fresh so the thread list sorts correctly.
create or replace function public.touch_conversation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists conversation_messages_touch on conversation_messages;
create trigger conversation_messages_touch
  after insert on conversation_messages
  for each row execute function public.touch_conversation();
