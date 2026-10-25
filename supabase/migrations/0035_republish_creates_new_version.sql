-- RP Hope — re-publishing a draft with new content must create a new version
--
-- THE PROBLEM
-- -----------
-- publish_gene_version's idempotency guard returned early whenever the draft
-- already had a published version:
--
--   where v.gene_slug = p_gene_slug and v.status = 'published'
--     and v.source_draft_id = p_draft_id
--
-- That was meant to absorb a double-click. But a gene that is re-reviewed is
-- re-reviewed on the SAME draft row, so every later publish of it matched the
-- guard, inserted nothing, and still returned a version id. The portal then
-- reported "Published" and logged draft_published while the live page kept
-- serving the old version. Seen on ABCA4 and AGBL5 (October 2026).
--
-- THE FIX
-- -------
-- The guard now also requires the content to be identical. A genuine
-- double-submit (same draft, same content) is still a no-op; a re-review that
-- changed the content archives the old version and publishes a new one.
--
-- Body is otherwise 0034's unchanged — keep the table aliases (see 0014/0034:
-- the OUT column gene_slug collides with gene_page_versions.gene_slug).
--
-- Apply in the Supabase SQL editor. Safe to re-run.

create or replace function public.publish_gene_version(
  p_draft_id     uuid,
  p_gene_slug    text,
  p_content      jsonb,
  p_approver     uuid,
  p_assignment_id uuid
) returns table (version_id uuid, gene_slug text)
language plpgsql security definer set search_path = '' as $$
declare
  v_next     integer;
  v_new_id   uuid;
  v_existing uuid;
  v_reviewer text;
begin
  -- Serialize concurrent publishes for THIS gene until this txn commits.
  perform pg_advisory_xact_lock(hashtext('gene_publish:' || p_gene_slug));

  -- Idempotency / double-submit guard: the SAME draft with the SAME content
  -- is already live. Different content from the same draft falls through and
  -- publishes a new version.
  select v.id into v_existing
  from public.gene_page_versions v
  where v.gene_slug = p_gene_slug and v.status = 'published'
    and v.source_draft_id = p_draft_id and v.content = p_content
  limit 1;
  if v_existing is not null then
    version_id := v_existing;
    gene_slug := p_gene_slug;
    return next;
    return;
  end if;

  -- Who reviewed this: the person who SUBMITTED the draft, not the admin who
  -- published it. Falls back to the publisher only when there is no submitter
  -- (an override publish of something never submitted).
  select coalesce(rp_sub.display_name, rp_app.display_name)
    into v_reviewer
    from public.gene_page_drafts d
    left join public.reviewer_profiles rp_sub on rp_sub.user_id = d.submitted_by
    left join public.reviewer_profiles rp_app on rp_app.user_id = p_approver
   where d.id = p_draft_id;

  update public.gene_page_versions v
    set status = 'archived'
    where v.gene_slug = p_gene_slug and v.status = 'published';

  select coalesce(max(v.version_number), 0) + 1 into v_next
    from public.gene_page_versions v where v.gene_slug = p_gene_slug;

  insert into public.gene_page_versions
    (gene_slug, version_number, content, status, source_draft_id,
     approved_by, approved_at, published_at, reviewer_name)
  values
    (p_gene_slug, v_next, p_content, 'published', p_draft_id,
     p_approver, now(), now(), v_reviewer)
  returning id into v_new_id;

  update public.gene_page_drafts d
    set review_status = 'approved', reviewed_by = p_approver, reviewed_at = now()
    where d.id = p_draft_id;

  if p_assignment_id is not null then
    update public.draft_assignments a
      set status = 'completed', completed_at = now()
      where a.id = p_assignment_id;
  end if;

  version_id := v_new_id;
  gene_slug := p_gene_slug;
  return next;
end;
$$;

revoke execute on function public.publish_gene_version(uuid, text, jsonb, uuid, uuid) from public;
revoke execute on function public.publish_gene_version(uuid, text, jsonb, uuid, uuid) from anon, authenticated;
grant  execute on function public.publish_gene_version(uuid, text, jsonb, uuid, uuid) to service_role;
