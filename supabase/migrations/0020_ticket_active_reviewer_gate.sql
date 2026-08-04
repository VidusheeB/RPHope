-- RP Hope Admin Phase 1 — authorization audit fix #2
--
-- review_tickets/ticket_replies policies (0010) let the ORIGINAL FILER read/
-- reply via `created_by = auth.uid()` alone — unlike gene_page_drafts/
-- draft_sentence_reviews/review_flag_resolutions, which were already
-- hardened in 0013 to also require reviewer_profiles.active. A deactivated
-- reviewer with a still-valid (not yet expired/signed-out) JWT could still
-- read and reply to tickets they filed before deactivation via a direct
-- API call — the app's own session check (getReviewerSession() returns
-- null for an inactive profile) blocks the normal UI path, but that's not
-- a substitute for DB-level enforcement against direct requests, which is
-- exactly what this audit was asked to verify.
--
-- Apply in the Supabase SQL editor after 0019.

create or replace function public.auth_is_active_reviewer()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.reviewer_profiles where user_id = auth.uid() and active
  );
$$;

revoke execute on function public.auth_is_active_reviewer() from public;
grant execute on function public.auth_is_active_reviewer() to authenticated;

drop policy if exists rt_select on review_tickets;
create policy rt_select on review_tickets
  for select using ((created_by = auth.uid() and auth_is_active_reviewer()) or auth_is_admin());

drop policy if exists trep_select on ticket_replies;
create policy trep_select on ticket_replies
  for select using (
    auth_is_admin()
    or (
      auth_is_active_reviewer()
      and not internal_note
      and exists (
        select 1 from review_tickets t
        where t.id = ticket_replies.ticket_id and t.created_by = auth.uid()
      )
    )
  );

drop policy if exists trep_insert on ticket_replies;
create policy trep_insert on ticket_replies
  for insert with check (
    author = auth.uid()
    and (
      auth_is_admin()
      or (
        auth_is_active_reviewer()
        and not internal_note
        and exists (
          select 1 from review_tickets t
          where t.id = ticket_replies.ticket_id and t.created_by = auth.uid()
        )
      )
    )
  );
