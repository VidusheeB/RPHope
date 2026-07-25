-- RP Hope — review tickets ("Report an issue")
--
-- Lets a reviewer flag a problem with a draft without leaving the review
-- workspace or losing unsaved edits (the button opens a drawer, not a new
-- page). Admins triage in a ticket inbox. A `blocking` ticket that isn't
-- resolved/closed prevents Submit review / Approve & Publish — enforced in
-- application code (lib/reviewer/publishGate.ts) using the open-blocking
-- count this table makes queryable.
--
-- RLS: a reviewer reads/creates/replies only on tickets THEY filed
-- (created_by = auth.uid()) and never sees internal_note replies; admins
-- have full access. Same auth_is_admin() helper as everywhere else.
--
-- Apply in the Supabase SQL editor after 0009.

do $$ begin
  create type ticket_status as enum
    ('open', 'acknowledged', 'in_progress', 'waiting_for_reviewer', 'resolved', 'closed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type ticket_severity as enum ('low', 'normal', 'high', 'critical');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type ticket_type as enum
    ('scientific_accuracy', 'missing_or_incorrect_source', 'ai_content_problem',
     'page_structure', 'technical_problem', 'access_or_permissions', 'other');
exception when duplicate_object then null;
end $$;

create table if not exists review_tickets (
  id              uuid primary key default uuid_generate_v4(),
  ticket_number   integer generated always as identity,
  draft_id        uuid not null references gene_page_drafts (id) on delete cascade,
  section_key     text,
  type            ticket_type not null,
  subject         text not null,
  description     text not null,
  severity        ticket_severity not null default 'normal',
  blocking        boolean not null default false,
  status          ticket_status not null default 'open',
  created_by      uuid not null references auth.users (id),
  assigned_admin  uuid references auth.users (id),
  page_url        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists review_tickets_draft_idx on review_tickets (draft_id);
create index if not exists review_tickets_status_idx on review_tickets (status);

create table if not exists ticket_replies (
  id            uuid primary key default uuid_generate_v4(),
  ticket_id     uuid not null references review_tickets (id) on delete cascade,
  author        uuid not null references auth.users (id),
  body          text not null,
  internal_note boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists ticket_replies_ticket_idx on ticket_replies (ticket_id);

-- Keep updated_at current on every status/reply-triggered change.
create or replace function public.touch_review_ticket()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.review_tickets set updated_at = now() where id = new.id;
  return new;
end;
$$;
drop trigger if exists review_tickets_touch on review_tickets;
create trigger review_tickets_touch
  before update on review_tickets
  for each row execute function public.touch_review_ticket();

alter table review_tickets enable row level security;
alter table ticket_replies enable row level security;

-- review_tickets: the filer reads/updates their own; admins read/update all.
-- Anyone signed in with draft access (assignee or admin) may file one.
drop policy if exists rt_select on review_tickets;
create policy rt_select on review_tickets
  for select using (created_by = auth.uid() or auth_is_admin());
drop policy if exists rt_insert on review_tickets;
create policy rt_insert on review_tickets
  for insert with check (
    created_by = auth.uid() and (auth_is_assigned(draft_id) or auth_is_admin())
  );
drop policy if exists rt_update on review_tickets;
create policy rt_update on review_tickets
  for update using (auth_is_admin()) with check (auth_is_admin());

-- ticket_replies: a non-admin sees only their own tickets' replies, and never
-- internal_note rows (those are admin-to-admin). Admins see and write everything.
drop policy if exists trep_select on ticket_replies;
create policy trep_select on ticket_replies
  for select using (
    auth_is_admin()
    or (
      not internal_note
      and exists (
        select 1 from review_tickets t
        where t.id = ticket_replies.ticket_id and t.created_by = auth.uid()
      )
    )
  );
drop policy if exists trep_insert on ticket_replies;
create policy trep_insert on ticket_replies
  for insert with check (
    author = auth.uid()
    and (
      auth_is_admin()
      or (
        not internal_note
        and exists (
          select 1 from review_tickets t
          where t.id = ticket_replies.ticket_id and t.created_by = auth.uid()
        )
      )
    )
  );
