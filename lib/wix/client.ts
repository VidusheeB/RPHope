import { createClient, ApiKeyStrategy } from "@wix/sdk";
import { wixEventsV2, rsvpV2 } from "@wix/events";

// Server-only Wix client. Wix Events is the source of truth for events and
// registrations — Carin manages everything from the Wix dashboard and this app
// only reads events and writes RSVPs back into it.
//
// Both Events read (SCOPE.DC-EVENTS.READ-EVENTS) and RSVP creation
// (SCOPE.DC-EVENTS.MANAGE-GUEST-LIST) are elevated scopes that are NOT
// visitor-safe, so every call goes through our server with an API key. Never
// import this into a Client Component.
//
// Guarded like `stripeConfigured` so the app still builds and /events renders a
// graceful empty state before the Wix credentials are provisioned.
const apiKey = process.env.WIX_API_KEY;
const siteId = process.env.WIX_SITE_ID;

export const wixConfigured = Boolean(apiKey && siteId);

export const wixClient =
  apiKey && siteId
    ? createClient({
        auth: ApiKeyStrategy({ apiKey, siteId }),
        modules: { events: wixEventsV2, rsvp: rsvpV2 },
      })
    : null;
