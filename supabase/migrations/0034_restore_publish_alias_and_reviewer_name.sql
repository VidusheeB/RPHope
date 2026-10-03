-- RP Hope — restore the gene_slug aliasing that 0032 regressed
--
-- MY MISTAKE, PLAINLY
-- -------------------
-- 0032 needed publish_gene_version to also record reviewer_name. I rewrote the
-- function starting from the copy in 0003 — and in doing so threw away the fix
-- 0014 had made to it.
--
-- 0014's point: `returns table (version_id uuid, gene_slug text)` implicitly
-- declares gene_slug as a PL/pgSQL variable, which collides with
-- gene_page_versions.gene_slug in every bare `where gene_slug = ...`. Postgres
-- cannot tell the column from the OUT variable and raises "column reference
-- gene_slug is ambiguous". 0014 fixed it by aliasing the table everywhere;
-- 0032 silently undid that, and publishing started failing again.
--
-- This version is 0014's aliased body WITH 0032's reviewer_name addition, so
-- both fixes survive together. Keep the aliases if you ever touch this again.
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

  -- Idempotency / double-submit guard.
  select v.id into v_existing
  from public.gene_page_versions v
  where v.gene_slug = p_gene_slug and v.status = 'published' and v.source_draft_id = p_draft_id
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
