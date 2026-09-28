-- RP Hope — fix "stack depth limit exceeded" on every ticket update
--
-- THE BUG
-- -------
-- 0010 created a BEFORE UPDATE trigger on review_tickets whose function ran:
--
--     update public.review_tickets set updated_at = now() where id = new.id;
--
-- An UPDATE on the same table from inside its own BEFORE UPDATE trigger
-- re-fires the trigger, which updates again, which re-fires it. Postgres
-- unwinds this with "stack depth limit exceeded", and the raw message
-- surfaced in the portal UI.
--
-- Every update to a ticket therefore failed: resolving one, delegating it,
-- changing its status. It presented as two unrelated complaints — "I can't
-- resolve a ticket" and a red error under the reply box — with one cause.
--
-- The correct form for a BEFORE trigger is to ASSIGN to NEW. The row being
-- written is still in flight, so setting the field mutates the pending row
-- rather than starting a second write.
create or replace function public.touch_review_ticket()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists review_tickets_touch on review_tickets;
create trigger review_tickets_touch
  before update on review_tickets
  for each row execute function public.touch_review_ticket();

-- THE HALF THAT NEVER WORKED
-- --------------------------
-- 0010's comment said "keep updated_at current on every status/reply-triggered
-- change", but nothing was ever attached to ticket_replies — so posting a
-- reply did not touch the ticket at all, and updated_at only moved when the
-- ticket itself was edited (which, per above, always failed).
--
-- That matters beyond tidiness: the conversation list sorts by updated_at, so
-- a thread with a new reply never rose to the top. A reply is the single most
-- common reason a ticket becomes current.
--
-- This one is an AFTER INSERT on a DIFFERENT table, so an UPDATE here is the
-- right tool and carries no recursion risk.
create or replace function public.touch_ticket_on_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.review_tickets
     set updated_at = now()
   where id = new.ticket_id;
  return new;
end;
$$;

drop trigger if exists ticket_replies_touch_ticket on ticket_replies;
create trigger ticket_replies_touch_ticket
  after insert on ticket_replies
  for each row execute function public.touch_ticket_on_reply();
