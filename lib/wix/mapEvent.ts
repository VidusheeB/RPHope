// Pure mapping from Wix's `Event` shape into this site's narrow `SiteEvent`.
// Kept free of network calls so it can be tested directly against fixtures.

import { media } from "@wix/sdk";
import type { wixEventsV2 } from "@wix/events";
import { toRegistrationFields } from "./formSchema";
import type { RegistrationState, SiteEvent } from "./types";

type WixEvent = wixEventsV2.Event;

/**
 * Wix returns descriptions as Ricos rich-content nodes (structured JSON), not
 * HTML. We walk the tree and keep only text, so there is no markup to sanitize
 * and no path to injected HTML — `dangerouslySetInnerHTML` is never needed.
 */
export function extractParagraphs(content: wixEventsV2.RichContent | undefined): string[] {
  if (!content?.nodes) return [];

  const textOf = (node: unknown): string => {
    if (!node || typeof node !== "object") return "";
    const n = node as { textData?: { text?: string }; nodes?: unknown[] };
    const own = n.textData?.text ?? "";
    const children = Array.isArray(n.nodes) ? n.nodes.map(textOf).join("") : "";
    return own + children;
  };

  return content.nodes
    .map((node) => textOf(node).replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function imageFrom(mainImage: string | undefined): { url: string | null; alt: string | null } {
  if (!mainImage) return { url: null, alt: null };
  // Wix stores `wix:image://...` URIs; getImageUrl resolves them to a real CDN
  // URL. Already-resolved https URLs are passed through untouched.
  if (mainImage.startsWith("http")) return { url: mainImage, alt: null };
  try {
    const resolved = media.getImageUrl(mainImage);
    return { url: resolved.url, alt: resolved.altText || null };
  } catch {
    return { url: null, alt: null };
  }
}

/**
 * Decide what the visitor can actually do right now.
 *
 * Deliberately conservative: anything we can't positively confirm is open falls
 * through to "closed" rather than showing a registration form that Wix would
 * then reject.
 */
export function registrationStateOf(event: WixEvent): RegistrationState {
  if (event.status === "ENDED" || event.status === "CANCELED") return "ended";

  const registration = event.registration;
  if (!registration) return "none";
  if (registration.registrationDisabled) return "none";
  if (registration.registrationPaused) return "closed";

  switch (registration.status) {
    case "OPEN_RSVP":
      return "open";
    case "OPEN_RSVP_WAITLIST_ONLY":
      return "waitlist";
    case "SCHEDULED_RSVP":
      return "scheduled";
    case "OPEN_TICKETS":
      return "tickets";
    case "OPEN_EXTERNAL":
      return "external";
    case "CLOSED_AUTOMATICALLY":
    case "CLOSED_MANUALLY":
      return "closed";
    default:
      break;
  }

  switch (registration.type) {
    case "TICKETING":
      return "tickets";
    case "EXTERNAL":
      return "external";
    case "NONE":
      return "none";
    default:
      return "closed";
  }
}

function addressOf(location: wixEventsV2.Location | undefined): string | null {
  const address = location?.address;
  if (!address) return null;
  const street =
    address.addressLine ||
    [address.streetAddress?.number, address.streetAddress?.name].filter(Boolean).join(" ");
  const parts = [street, address.city, address.subdivision, address.postalCode, address.country];
  const joined = parts.filter(Boolean).join(", ").trim();
  return joined || null;
}

const iso = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export function toSiteEvent(event: WixEvent): SiteEvent | null {
  // Without an id and slug there is nothing to link to or register against.
  if (!event._id || !event.slug) return null;

  const dateSettings = event.dateAndTimeSettings;
  const image = imageFrom(event.mainImage);

  return {
    id: event._id,
    slug: event.slug,
    title: event.title?.trim() || "Untitled event",
    shortDescription: event.shortDescription?.trim() || null,
    descriptionParagraphs: extractParagraphs(event.description),
    imageUrl: image.url,
    imageAlt: image.alt,
    start: iso(dateSettings?.startDate),
    end: iso(dateSettings?.endDate),
    timeZone: dateSettings?.timeZoneId ?? null,
    hideEndDate: Boolean(dateSettings?.hideEndDate),
    dateTbd: Boolean(dateSettings?.dateAndTimeTbd),
    dateTbdMessage: dateSettings?.dateAndTimeTbdMessage?.trim() || null,
    locationType: event.location?.type === "ONLINE" ? "ONLINE" : event.location ? "VENUE" : null,
    locationName: event.location?.name?.trim() || null,
    locationAddress: addressOf(event.location),
    registrationState: registrationStateOf(event),
    externalUrl: event.registration?.external?.url ?? null,
    allowsNoResponse: event.registration?.rsvp?.responseType === "YES_AND_NO",
    fields: toRegistrationFields(event.form?.controls),
  };
}
