-- RP Hope — in-app notifications for the reviewer portal
--
-- Purely in-app (bell + unread badge in the /review header). No email is
-- involved: lib/email.ts exists for the Share Your Story flow but is
-- deliberately not wired here.
--
-- Rows are written server-side by the action that triggers them (submit
-- review, request changes, publish, assignment, ticket create/reply) — no
-- event bus, just one extra insert alongside the mutation that already
-- happens.
--
-- RLS: a user reads and marks-read ONLY their own rows. There is no policy
-- letting anyone read someone else's notifications, and inserts come from
-- the service-role client inside those actions.
--
-- Apply in the Supabase SQL editor after 0010.

create table if not exists notifications (
  id          uuid primary key default uuid_generate_v4(),
  recipient   uuid not null references auth.users (id) on delete cascade,
  actor       uuid references auth.users (id),
  type        text not null,
  title       text not null,
  body        text,
  draft_id    uuid references gene_page_drafts (id) on delete cascade,
  ticket_id   uuid references review_tickets (id) on delete cascade,
  href        text,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_recipient_idx on notifications (recipient, read);
create index if not exists notifications_created_idx on notifications (recipient, created_at desc);

alter table notifications enable row level security;

-- A user sees only their own notifications. No admin bypass here on purpose:
-- an admin's inbox is their own, not everyone's.
drop policy if exists notif_select_own on notifications;
create policy notif_select_own on notifications
  for select using (recipient = auth.uid());

-- Marking read is the only update a recipient may make; the check clause
-- keeps them from reassigning a row to someone else.
drop policy if exists notif_update_own on notifications;
create policy notif_update_own on notifications
  for update using (recipient = auth.uid()) with check (recipient = auth.uid());
