// Reads events from Wix Events. Wix is the source of truth: nothing here is
// cached in Supabase and no event content is hardcoded, so an edit Carin makes
// in the Wix dashboard shows up on the site without a deployment.

import { wixClient } from "./client";
import { toSiteEvent } from "./mapEvent";
import type { SiteEvent } from "./types";

// Grid fields. FORM is deliberately omitted — the list doesn't render questions
// and the form definition is a large payload per event.
const LIST_FIELDS = ["DETAILS", "REGISTRATION"] as const;
const DETAIL_FIELDS = ["DETAILS", "TEXTS", "REGISTRATION", "FORM", "URLS"] as const;

const LIST_LIMIT = 50;

/**
 * Upcoming and in-progress events, soonest first.
 *
 * Draft events are excluded by Wix unless `includeDrafts` is set (which we never
 * do), so an event Carin is still writing stays private automatically.
 *
 * `unavailable` separates "Wix didn't answer" from "there genuinely are no
 * upcoming events" so the page can say the honest thing in each case.
 */
export async function listUpcomingEvents(): Promise<{
  events: SiteEvent[];
  unavailable: boolean;
}> {
  if (!wixClient) return { events: [], unavailable: true };

  try {
    const result = await wixClient.events
      .queryEvents({ fields: [...LIST_FIELDS] })
      .in("status", ["UPCOMING", "STARTED"])
      .ascending("dateAndTimeSettings.startDate")
      .limit(LIST_LIMIT)
      .find();

    const events = result.items
      .map(toSiteEvent)
      .filter((event): event is SiteEvent => event !== null);
    return { events, unavailable: false };
  } catch (error) {
    // A visitor should see a calm message, never a stack trace.
    console.error("[wix] listUpcomingEvents failed:", errorCode(error));
    return { events: [], unavailable: true };
  }
}

/** Full detail for one event, including the live registration-form definition. */
export async function getEventBySlug(slug: string): Promise<SiteEvent | null> {
  if (!wixClient || !slug) return null;

  try {
    const response = await wixClient.events.getEventBySlug(slug, {
      fields: [...DETAIL_FIELDS],
    });
    return response.event ? toSiteEvent(response.event) : null;
  } catch (error) {
    console.error(`[wix] getEventBySlug failed for "${slug}":`, errorCode(error));
    return null;
  }
}

/**
 * Authoritative, uncached registration check used at submit time.
 *
 * The browser's copy of an event can be minutes old, so the registration route
 * re-reads state and questions straight from Wix before writing anything.
 */
export async function getEventForRegistration(eventId: string): Promise<SiteEvent | null> {
  if (!wixClient || !eventId) return null;

  try {
    // Unlike getEventBySlug, getEvent resolves to the Event itself.
    const event = await wixClient.events.getEvent(eventId, {
      fields: [...DETAIL_FIELDS],
    });
    return event ? toSiteEvent(event) : null;
  } catch (error) {
    console.error(`[wix] getEvent failed for ${eventId}:`, errorCode(error));
    return null;
  }
}

/** Non-PII error identifier safe to write to server logs. */
function errorCode(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as { details?: { applicationError?: { code?: string } }; message?: string };
    const code = e.details?.applicationError?.code;
    if (code) return code;
    if (e.message) return e.message.slice(0, 200);
  }
  return "unknown error";
}
