-- RP Hope — close the story_submissions PII exposure
-- PART 1 of 2 — ADDITIVE. Safe to run at any time, including before the
-- matching code is deployed. It only ADDS a view; nothing starts failing.
-- Run 0024b_story_revoke_base_table.sql only AFTER the code that reads this
-- view is live (see that file's header for why the order matters).
--
-- THE BUG (confirmed against the live database, 2026-09-18)
-- ---------------------------------------------------------
-- 0004 enabled RLS on story_submissions with:
--     using (status = 'published')
-- and its header claims the Section-1 columns are "never selected by the
-- public RLS policy below". That is not what RLS does. A policy's USING clause
-- filters ROWS, not COLUMNS — once a row is visible, every column of it is
-- readable. So every published story exposed full_name, email, phone,
-- contact_method, consent_to_publish, edit_permission and approval_token to
-- anyone holding the anon key, which ships in the browser bundle and is
-- therefore public:
--
--   curl "$URL/rest/v1/story_submissions?status=eq.published&select=full_name,email,phone" \
--        -H "apikey: $ANON_KEY"
--
-- That call returned real submitter names and email addresses. The only thing
-- preventing it was that OUR client (lib/storySubmissionsRepo.ts) selected a
-- narrower column list — a convention on the caller, which does nothing about
-- a direct REST request.
--
-- WHY A VIEW AND NOT COLUMN GRANTS
-- --------------------------------
-- email/phone are CONDITIONALLY public: a submitter picks display_contact
-- ('email' | 'phone' | 'none') to choose whether one of them appears on their
-- published story. A flat column grant cannot express "this column is public
-- only when that column says so", so it would either leak both or break the
-- feature. The view resolves the choice in the database and publishes a single
-- `contact_value`, so the contact method the submitter did NOT choose is not
-- reachable at all — and when they chose 'none', neither is.
--
-- The view deliberately relies on the DEFAULT (definer) execution semantics,
-- NOT `security_invoker = on`. The whole point is that the caller ends up with
-- no privilege on the base table, so the view must read it as its owner; its
-- own WHERE clause re-applies the published-only row filter RLS was providing.
-- With security_invoker the caller would need SELECT on email and phone to
-- evaluate the CASE, which is exactly the leak being closed.

create or replace view public.public_stories as
  select
    id,
    display_name,
    display_contact,
    case display_contact
      when 'email' then email
      when 'phone' then phone
      else null
    end as contact_value,
    gene_slug,
    story_text,
    video_path,
    audio_path,
    published_at
  from public.story_submissions
  where status = 'published';

comment on view public.public_stories is
  'Public projection of published stories. The ONLY story surface the anon key may read. Resolves the submitter''s display_contact choice into a single contact_value so the unchosen contact column is never exposed.';

grant select on public.public_stories to anon, authenticated;

-- Verify before moving on:
--   select * from public.public_stories limit 5;
-- Expect: published rows only; a contact_value column; and NO full_name,
-- phone, consent_to_publish, edit_permission or approval_token columns.
