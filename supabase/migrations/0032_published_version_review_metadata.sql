-- RP Hope — real review metadata on published gene pages
--
-- The public gene page footer read:
--     Last reviewed: published, human-reviewed version    Reviewer: —
--
-- Both were placeholders. The page hardcoded that phrase and passed no
-- reviewer at all, so every published gene showed the same line no matter who
-- reviewed it or when — on pages whose whole credibility rests on a human
-- having checked the medical content.
--
-- published_at was already stored and simply never selected. The reviewer's
-- NAME was not stored anywhere reachable: gene_page_versions records
-- approved_by (a uuid, and the publishing admin rather than the reviewer), and
-- reviewer_profiles is admin-only under RLS, so a public page using the anon
-- key cannot resolve a uuid to a name.
--
-- So the name is captured onto the version row at publish time. That also
-- matches how these rows already behave: a published version is an immutable
-- snapshot of what went live, and who reviewed it is part of that snapshot.
-- Renaming someone later must not silently rewrite the attribution on pages
-- already published.
--
-- Apply in the Supabase SQL editor. Safe to re-run.

alter table gene_page_versions add column if not exists reviewer_name text;

comment on column gene_page_versions.reviewer_name is
  'Display name of the human reviewer who verified this version, captured at publish time. Denormalised deliberately: the public page reads with the anon key and cannot see reviewer_profiles, and a published version is an immutable snapshot that should not change when someone is later renamed.';

-- ---------------------------------------------------------------------------
-- Populate it during publish. No signature change: the function is SECURITY
-- DEFINER, so it can resolve the reviewer from the draft itself rather than
-- making every caller pass a name they would have to look up first.
--
-- The reviewer is the person who SUBMITTED the draft (submitted_by), not the
-- admin who published it. Those are different people and the footer means the
-- former.
-- ---------------------------------------------------------------------------
create or replace function public.publish_gene_version(
  p_draft_id     uuid,
  p_gene_slug    text,
  p_content      jsonb,
  p_approver     uuid,
  p_assignment_id uuid
) returns table (version_id uuid, gene_slug text)
language plpgsql security definer set search_path = '' as $$
declare
  v_next    integer;
  v_new_id  uuid;
  v_existing uuid;
  v_reviewer text;
begin
  perform pg_advisory_xact_lock(hashtext('gene_publish:' || p_gene_slug));

  select id into v_existing
  from public.gene_page_versions
  where gene_slug = p_gene_slug and status = 'published' and source_draft_id = p_draft_id
  limit 1;
  if v_existing is not null then
    version_id := v_existing;
    gene_slug := p_gene_slug;
    return next;
    return;
  end if;

  -- Who reviewed this. Falls back to the publishing admin only when the draft
  -- has no submitter — an admin-override publish of something never submitted.
  select coalesce(rp_submitter.display_name, rp_approver.display_name)
    into v_reviewer
    from public.gene_page_drafts d
    left join public.reviewer_profiles rp_submitter on rp_submitter.user_id = d.submitted_by
    left join public.reviewer_profiles rp_approver  on rp_approver.user_id  = p_approver
   where d.id = p_draft_id;

  update public.gene_page_versions
    set status = 'archived'
    where gene_slug = p_gene_slug and status = 'published';

  select coalesce(max(version_number), 0) + 1 into v_next
    from public.gene_page_versions where gene_slug = p_gene_slug;

  insert into public.gene_page_versions
    (gene_slug, version_number, content, status, source_draft_id,
     approved_by, approved_at, published_at, reviewer_name)
  values
    (p_gene_slug, v_next, p_content, 'published', p_draft_id,
     p_approver, now(), now(), v_reviewer)
  returning id into v_new_id;

  update public.gene_page_drafts
    set review_status = 'approved', reviewed_by = p_approver, reviewed_at = now()
    where id = p_draft_id;

  if p_assignment_id is not null then
    update public.draft_assignments
      set status = 'completed', completed_at = now()
      where id = p_assignment_id;
  end if;

  version_id := v_new_id;
  gene_slug := p_gene_slug;
  return next;
end;
$$;

revoke execute on function public.publish_gene_version(uuid, text, jsonb, uuid, uuid) from public;
revoke execute on function public.publish_gene_version(uuid, text, jsonb, uuid, uuid) from anon, authenticated;
grant  execute on function public.publish_gene_version(uuid, text, jsonb, uuid, uuid) to service_role;

-- Backfill versions published before this column existed, so pages that are
-- already live stop showing an em dash.
--
-- CAREFUL WITH reviewed_by. gene_page_drafts.submitted_by is uuid, but
-- reviewed_by is TEXT — it predates the portal, when it held a free-text
-- reviewer name. publish_gene_version has written a uuid into it since 0003,
-- so the column now holds uuid-shaped strings for anything published through
-- the portal AND possibly real names for older CLI-era rows. A plain join
-- fails outright with "operator does not exist: uuid = text", and an
-- unguarded ::uuid cast would error on any row holding a name.
--
-- The CASE is what makes this safe: Postgres only evaluates the cast for rows
-- whose value actually looks like a uuid, so a legacy name is skipped rather
-- than crashing the migration.
update gene_page_versions v
   set reviewer_name = coalesce(
     (select rp.display_name
        from gene_page_drafts d
        join reviewer_profiles rp on rp.user_id = d.submitted_by
       where d.id = v.source_draft_id),
     (select rp.display_name
        from gene_page_drafts d
        join reviewer_profiles rp
          on rp.user_id = case
               when d.reviewed_by ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
               then d.reviewed_by::uuid
             end
       where d.id = v.source_draft_id)
   )
 where v.reviewer_name is null;

-- The public page reads gene_page_versions with the ANON key, so the
-- published-only select policy from 0003 already covers this column. No new
-- grant is needed, and none should be added — reviewer_profiles itself must
-- stay admin-only.
