-- RP Hope — sentence-level verification for gene drafts
--
-- One row per sentence per draft, tracking the reviewer's verification
-- outcome, any edit they made, and an audit trail (original vs final text
-- and source IDs, who verified it, when). RLS mirrors review_flag_resolutions
-- from 0003 exactly: the active assignee or an admin.
--
-- Apply in the Supabase SQL editor after 0008.

do $$ begin
  create type sentence_verification_status as enum
    ('unreviewed', 'verified_as_written', 'edited_and_verified', 'removed', 'not_applicable');
exception when duplicate_object then null;
end $$;

create table if not exists draft_sentence_reviews (
  id                   uuid primary key default uuid_generate_v4(),
  draft_id             uuid not null references gene_page_drafts (id) on delete cascade,
  section_key          text not null,
  sentence_index       integer not null,
  original_text        text not null,
  final_text           text not null,
  original_source_ids  jsonb not null default '[]',
  final_source_ids     jsonb not null default '[]',
  status               sentence_verification_status not null default 'unreviewed',
  reviewer_note        text,
  reviewed_by          uuid references auth.users (id),
  reviewed_at          timestamptz,
  unique (draft_id, section_key, sentence_index)
);
create index if not exists draft_sentence_reviews_draft_idx on draft_sentence_reviews (draft_id);

alter table draft_sentence_reviews enable row level security;

drop policy if exists dsr_select on draft_sentence_reviews;
create policy dsr_select on draft_sentence_reviews
  for select using (auth_is_assigned(draft_id) or auth_is_admin());

drop policy if exists dsr_insert on draft_sentence_reviews;
create policy dsr_insert on draft_sentence_reviews
  for insert with check (auth_is_active_assignee(draft_id) or auth_is_admin());

drop policy if exists dsr_update on draft_sentence_reviews;
create policy dsr_update on draft_sentence_reviews
  for update using (auth_is_active_assignee(draft_id) or auth_is_admin())
  with check (auth_is_active_assignee(draft_id) or auth_is_admin());
