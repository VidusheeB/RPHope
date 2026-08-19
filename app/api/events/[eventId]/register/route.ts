// Event registration endpoint. Writes an RSVP straight into Wix Events, which
// stays the single source of truth — no registration row is created here.
//
// The event state and its questions are re-read from Wix on every call, so a
// visitor whose tab was open while registration closed is rejected rather than
// being trusted on the browser's stale copy.

import { NextResponse } from "next/server";
import { z } from "zod";
import { wixConfigured } from "@/lib/wix/client";
import { getEventForRegistration } from "@/lib/wix/events";
import { extractIdentity, validateAnswers } from "@/lib/wix/formSchema";
import { createRsvp } from "@/lib/wix/rsvp";
import { rateLimit, clientKey } from "@/lib/voice/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 20_000;

const bodySchema = z.object({
  values: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  status: z.enum(["YES", "NO", "WAITLIST"]).default("YES"),
});

export async function POST(req: Request, { params }: { params: { eventId: string } }) {
  if (!wixConfigured) {
    return NextResponse.json(
      { error: "Event registration is not configured yet. Please email information@rphope.org." },
      { status: 503 },
    );
  }

  const limit = rateLimit(`events-register:${clientKey(req)}`, { limit: 10, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec ?? 30) } },
    );
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "That submission is too large." }, { status: 413 });
  }

  const parsed = bodySchema.safeParse(safeJson(raw));
  if (!parsed.success) {
    return NextResponse.json({ error: "We couldn't read your registration." }, { status: 400 });
  }

  // Authoritative re-read: current registration state AND current questions.
  const event = await getEventForRegistration(params.eventId);
  if (!event) {
    return NextResponse.json(
      { error: "We couldn't find that event. It may have been removed." },
      { status: 404 },
    );
  }

  const state = event.registrationState;
  if (state !== "open" && state !== "waitlist") {
    return NextResponse.json({ error: closedMessage(state) }, { status: 409 });
  }

  const { values, status } = parsed.data;
  if (status === "NO" && !event.allowsNoResponse) {
    return NextResponse.json(
      { error: "This event only accepts a yes response." },
      { status: 400 },
    );
  }

  const fieldErrors = validateAnswers(event.fields, values);
  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json({ error: "Please check the highlighted fields.", fieldErrors }, {
      status: 400,
    });
  }

  const identity = extractIdentity(values);
  if (!identity.firstName || !identity.lastName || !identity.email) {
    return NextResponse.json(
      { error: "Please check the highlighted fields." },
      { status: 400 },
    );
  }

  // If Wix says the event is waitlist-only, honor that regardless of what the
  // browser asked for.
  const effectiveStatus = state === "waitlist" && status === "YES" ? "WAITLIST" : status;

  const outcome = await createRsvp({
    eventId: event.id,
    fields: event.fields,
    values,
    status: effectiveStatus,
    identity,
  });

  if (!outcome.ok) {
    const status = outcome.reason === "already_registered" ? 409 : 400;
    return NextResponse.json({ error: outcome.message, reason: outcome.reason }, { status });
  }

  // Wix is authoritative and sends its own confirmation email; we return only
  // the state, echoing back none of the submitted personal details.
  return NextResponse.json({ status: outcome.status });
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function closedMessage(state: string): string {
  switch (state) {
    case "scheduled":
      return "Registration for this event hasn't opened yet. Please check back soon.";
    case "ended":
      return "This event has already taken place.";
    case "external":
      return "Registration for this event happens on another site. Please use the link on the event page.";
    case "tickets":
      return "This event uses tickets. Please use the ticket link on the event page.";
    default:
      return "Registration for this event has closed. Please email us — there may still be room.";
  }
}
