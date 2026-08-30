-- Audit metadata invariants for gene_page_drafts.
--
-- Why this exists: four approved drafts (RPGR, LCA5, KIZ, INPP5E) were found
-- with reviewed_by set but reviewed_at NULL, and last_edited_by written on only
-- one of them. The app's approve path does set both, so the broken rows came
-- from a path that bypassed it (a direct Table Editor / PostgREST write, or a
-- deployed publish RPC older than migration 0014). Application code alone
-- therefore cannot be the guarantee — this trigger is.
--
-- It enforces, for every UPDATE regardless of who makes it:
--
--   1. Becoming 'approved' always carries a reviewed_at. If a write approves a
--      row without one, now() is stamped rather than leaving a half-recorded
--      approval. (reviewed_by cannot be invented here — see #4.)
--   2. Leaving 'approved' for any pending state CLEARS reviewed_by/reviewed_at.
--      The old approval described different content and must not be read as
--      applying to the new text.
--   3. Any change to a content column bumps last_activity_at, so "last activity"
--      is true even for a write that forgot to set it.
--   4. reviewed_by and reviewed_at are all-or-nothing. A row can never again be
--      left with one set and the other NULL.
--
-- last_edited_by is deliberately NOT defaulted here: under service_role
-- auth.uid() is NULL, so the trigger cannot know the human. The application
-- supplies it via lib/reviewer/auditStamp.ts; this trigger guarantees the
-- fields it CAN determine.
--
-- Apply in the Supabase SQL editor after 0021.

create or replace function public.enforce_gene_draft_audit_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_content_changed boolean;
begin
  -- 1. Approving must record when.
  if new.review_status = 'approved'
     and (old.review_status is distinct from 'approved' or new.reviewed_at is null)
     and new.reviewed_at is null then
    new.reviewed_at := now();
  end if;

  -- 2. Un-approving clears the stale approval.
  if old.review_status = 'approved'
     and new.review_status is distinct from 'approved'
     -- These are the real values of gene_draft_review_status (0002 + 0008).
     -- An earlier version of this migration listed a non-existent 'in_review',
     -- which made Postgres reject the whole UPDATE with
     -- "invalid input value for enum". RE-RUN THIS FILE if you applied it
     -- before that fix — it is create-or-replace, so re-running is safe.
     and new.review_status in ('unreviewed', 'submitted_for_approval', 'changes_requested')
  then
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;

  -- 3. A content change is activity.
  v_content_changed :=
       new.summary_card is distinct from old.summary_card
    or new.what_this_gene_means is distinct from old.what_this_gene_means
    or new.how_it_may_affect_vision is distinct from old.how_it_may_affect_vision
    or new.what_is_known is distinct from old.what_is_known
    or new.what_is_uncertain is distinct from old.what_is_uncertain
    or new.what_you_can_do_next is distinct from old.what_you_can_do_next
    or new.questions_for_clinician is distinct from old.questions_for_clinician
    or new.for_family_and_caregivers is distinct from old.for_family_and_caregivers
    or new.treatment_and_research is distinct from old.treatment_and_research
    or new.clinical_trial_summary is distinct from old.clinical_trial_summary
    or new.research_cards is distinct from old.research_cards
    or new.sources is distinct from old.sources;

  if v_content_changed and new.last_activity_at is not distinct from old.last_activity_at then
    new.last_activity_at := now();
  end if;

  -- 4. Never allow a half-recorded review again.
  if (new.reviewed_by is null) <> (new.reviewed_at is null) then
    raise exception
      'reviewed_by and reviewed_at must be set together (got reviewed_by=%, reviewed_at=%)',
      new.reviewed_by, new.reviewed_at;
  end if;

  return new;
end;
$$;

-- Runs AFTER the existing workflow-column guard (0019) alphabetically:
-- "gpd_workflow_columns_guard" < "gpd_zz_audit_metadata". The guard decides
-- WHETHER a workflow column may change; this then normalizes what was written.
drop trigger if exists gpd_zz_audit_metadata on gene_page_drafts;
create trigger gpd_zz_audit_metadata
  before update on gene_page_drafts
  for each row execute function public.enforce_gene_draft_audit_metadata();
