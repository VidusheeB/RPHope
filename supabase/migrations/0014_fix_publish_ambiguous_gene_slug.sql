-- RP Hope — fix "column reference gene_slug is ambiguous" on publish
--
-- publish_gene_version()'s `returns table (version_id uuid, gene_slug text)`
-- implicitly declares `gene_slug` as a PL/pgSQL variable inside the function
-- body. That variable name collides with gene_page_versions.gene_slug in
-- every bare `where gene_slug = p_gene_slug` clause, so Postgres can't tell
-- whether the reference means the column or the OUT variable — hence the
-- error the admin hit when actually publishing a draft through the RPC for
-- the first time (the 4 already-"Published" genes seen in the dashboard
-- were seeded directly into gene_page_versions during earlier content
-- population, never through this function, which is why this bug wasn't
-- caught until now).
--
-- Fix: alias the table in every WHERE clause so the column reference is
-- unambiguous. The function's public return shape (version_id, gene_slug)
-- is unchanged, so no caller-side changes are needed.
--
-- Apply in the Supabase SQL editor after 0013.

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
begin
  -- Serialize concurrent publishes for THIS gene until this txn commits.
  perform pg_advisory_xact_lock(hashtext('gene_publish:' || p_gene_slug));

  -- Idempotency / double-submit guard: if this draft already produced the
  -- current published version, return it without creating another.
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

  -- Archive the current published version (rolled back with everything else on
  -- any later failure in this function).
  update public.gene_page_versions v
    set status = 'archived'
    where v.gene_slug = p_gene_slug and v.status = 'published';

  select coalesce(max(v.version_number), 0) + 1 into v_next
    from public.gene_page_versions v where v.gene_slug = p_gene_slug;

  insert into public.gene_page_versions
    (gene_slug, version_number, content, status, source_draft_id, approved_by, approved_at, published_at)
  values
    (p_gene_slug, v_next, p_content, 'published', p_draft_id, p_approver, now(), now())
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
grant execute on function public.publish_gene_version(uuid, text, jsonb, uuid, uuid) to service_role;
