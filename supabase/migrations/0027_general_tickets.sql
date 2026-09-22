-- RP Hope Team Portal — general (non-gene) conversations
--
-- review_tickets.draft_id was NOT NULL, so every ticket had to hang off a gene
-- draft. The portal spec requires a reviewer to be able to start a general
-- conversation too ("I have a question about review guidelines"), which the
-- current schema simply cannot represent.
--
-- Making it nullable is the whole change. A ticket with draft_id = null is a
-- general conversation; one with a draft_id is gene-linked and carries that
-- context into the thread.
--
-- Apply in the Supabase SQL editor. Safe to re-run.

alter table review_tickets alter column draft_id drop not null;

comment on column review_tickets.draft_id is
  'The gene draft this conversation is about, or NULL for a general conversation not tied to a gene.';

-- The insert policy gated on auth_is_assigned(draft_id). With a null draft_id
-- that predicate is false (the subquery matches no rows), so a reviewer could
-- not open a general conversation at all — the policy would silently reject
-- exactly the case this migration exists to allow.
--
-- Rewritten so the gene-assignment check applies ONLY to gene-linked tickets.
-- A general ticket still requires created_by = auth.uid(), so someone can
-- only ever file as themselves; what it drops is the requirement to name a
-- gene you are assigned to.
drop policy if exists rt_insert on review_tickets;
create policy rt_insert on review_tickets
  for insert with check (
    created_by = auth.uid()
    and (
      draft_id is null                -- general conversation
      or auth_is_assigned(draft_id)   -- gene-linked: must be your assignment
      or auth_is_admin()
    )
  );

-- rt_select is unchanged and already correct for this:
--   using (created_by = auth.uid() or auth_is_admin())
-- A reviewer reads their own conversations, general or gene-linked, and never
-- another reviewer's. Admins read everything, which is what makes the inbox a
-- shared organisational workload rather than a per-admin queue.

-- Index the general case explicitly; without it, "my conversations" scans.
create index if not exists review_tickets_created_by_idx on review_tickets (created_by, updated_at desc);
