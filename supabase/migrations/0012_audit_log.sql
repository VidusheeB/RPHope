-- RP Hope — reviewer portal audit trail
--
-- One row per mutating action across the whole review lifecycle: invites,
-- role/active changes, assignment, review start, content/citation/
-- verification edits, flag resolution, submission, changes-requested,
-- reopening, ticket lifecycle, admin edits, approval, publication.
--
-- Admin-only read (service-role in the admin UI; no anon/authenticated
-- select policy at all — this is deliberately not even admin-readable via
-- the RLS-scoped client, matching how sensitive an audit log is). Writes
-- also go through the service-role client from inside the actions that
-- already mutate state — see lib/reviewer/audit.ts.
--
-- Apply in the Supabase SQL editor after 0011.

create table if not exists audit_log (
  id           uuid primary key default uuid_generate_v4(),
  actor        uuid references auth.users (id),
  action       text not null,
  draft_id     uuid references gene_page_drafts (id) on delete set null,
  reviewer_id  uuid references auth.users (id),
  ticket_id    uuid references review_tickets (id) on delete set null,
  before_value jsonb,
  after_value  jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists audit_log_draft_idx on audit_log (draft_id);
create index if not exists audit_log_created_idx on audit_log (created_at desc);

alter table audit_log enable row level security;
-- No select/insert/update policies for `authenticated` are created here on
-- purpose — RLS defaults to deny-all once enabled, so only the service-role
-- client (which bypasses RLS entirely) can read or write this table.
