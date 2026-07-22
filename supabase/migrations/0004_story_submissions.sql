-- RP Hope — story_submissions table + private video storage bucket
--
-- Backs the "Share your story" feature: a visitor submits a personal account
-- (typed, dictated, or uploaded as video), it lands here as `pending_review`,
-- a human reviewer edits it and either sends it back to the submitter for
-- approval (edit_permission = 'review_first', via the token-gated
-- /stories/approve/[token] page) or publishes it directly when the submitter
-- granted free-edit trust (edit_permission = 'free_edit'). Only once
-- status = 'published' does it render on the public /stories page — same
-- governance shape as research_items (see 0001_research_items.sql): every
-- new piece of user-submitted content is reviewed before it goes live.
--
-- Section 1 columns (full_name, email, phone, contact_method,
-- consent_to_publish, edit_permission) are PRIVATE — never selected by the
-- public RLS policy below and never rendered on any public page. Section 2
-- columns (display_name, display_contact, story_text, gene_slug) are the
-- public-facing content once published.
--
-- Apply with the Supabase SQL editor or `supabase db push`.

create extension if not exists "uuid-ossp";

do $$ begin
  create type story_status as enum ('pending_review', 'published', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type story_contact_method as enum ('email', 'phone');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type story_edit_permission as enum ('review_first', 'free_edit');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type story_display_contact as enum ('email', 'phone', 'none');
exception when duplicate_object then null;
end $$;

create table if not exists story_submissions (
  id                        uuid primary key default uuid_generate_v4(),

  -- Section 1 — private, for RP Hope's use only, never rendered publicly.
  full_name                 text not null,
  email                     text not null,
  phone                     text,                         -- required by app logic when contact_method = 'phone'
  contact_method            story_contact_method not null,
  consent_to_publish        boolean not null default false,
  edit_permission           story_edit_permission not null,

  -- Section 2 — the public-facing content once published.
  display_name              text not null,                -- "Anonymous" is a valid explicit value
  display_contact           story_display_contact not null default 'none',
  gene_slug                 text,                          -- optional, matches geneGrid slug
  story_text                text not null,                 -- current draft (typed, dictated, or reviewer-edited)
  story_text_raw            text,                          -- pre-synthesis original, kept for reviewer reference
  video_path                text,                          -- storage.objects path in the story-videos bucket

  -- Review / publish lifecycle.
  status                    story_status not null default 'pending_review',
  reviewer_notes            text,
  reviewed_by               text,
  reviewed_at               timestamptz,
  approval_token            text unique,                   -- set only when "send for approval" fires
  final_story_sent_at       timestamptz,
  submitter_responded_at    timestamptz,
  submitter_requested_changes boolean,
  published_at              timestamptz,
  created_at                timestamptz not null default now()
);

create index if not exists story_submissions_status_idx on story_submissions (status);
create index if not exists story_submissions_approval_token_idx on story_submissions (approval_token);

-- Row Level Security: the public site only ever reads PUBLISHED stories, and
-- only through lib/storySubmissionsRepo.ts, which selects the public columns
-- only (never full_name/email/phone/consent/edit_permission).
alter table story_submissions enable row level security;

drop policy if exists "public reads published stories" on story_submissions;
create policy "public reads published stories"
  on story_submissions for select
  using (status = 'published');

-- (No insert/update policy: the submit route, reviewer server actions, and
--  the token-gated approval action all write with the service-role key,
--  which bypasses RLS. The approval page's own security is the unguessable
--  token, not RLS — the row isn't `published` yet when it's read there.)

-- Private bucket for optional 3-5 minute video submissions. Not public: every
-- read/write goes through the service-role client (upload route, and
-- reviewer signed-URL generation for playback) — same trust boundary as the
-- table itself, so no storage.objects policies are needed.
insert into storage.buckets (id, name, public)
values ('story-videos', 'story-videos', false)
on conflict (id) do nothing;
