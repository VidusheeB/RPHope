// Event date/time display. Formatted in the event's OWN time zone (a global
// virtual event organized from another country must not silently render in the
// server's zone), with the zone shown so the reader can tell.

import type { SiteEvent } from "./types";

export function formatEventDate(event: SiteEvent): string {
  if (event.dateTbd) return event.dateTbdMessage || "Date to be announced";
  if (!event.start) return "Date to be announced";

  const timeZone = event.timeZone || undefined;
  const start = new Date(event.start);

  const datePart = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(start);

  const time = (value: Date) =>
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone,
      timeZoneName: "short",
    }).format(value);

  const end = !event.hideEndDate && event.end ? new Date(event.end) : null;
  const sameDay =
    end &&
    new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeZone }).format(end) ===
      new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeZone }).format(start);

  if (end && sameDay) {
    const endTime = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone,
      timeZoneName: "short",
    }).format(end);
    return `${datePart} · ${new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    }).format(start)}–${endTime}`;
  }
  if (end) {
    const endDate = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone,
    }).format(end);
    return `${datePart}, ${time(start)} – ${endDate}, ${time(end)}`;
  }
  return `${datePart} · ${time(start)}`;
}

export function formatEventLocation(event: SiteEvent): string {
  if (event.locationType === "ONLINE") return event.locationName?.trim() || "Online";
  return [event.locationName, event.locationAddress].filter(Boolean).join(" · ") || "Location to be announced";
}

/** Short label + whether it should read as an actionable invitation. */
export function registrationLabel(event: SiteEvent): string {
  switch (event.registrationState) {
    case "open":
      return "Registration open";
    case "waitlist":
      return "Waitlist open";
    case "scheduled":
      return "Registration opens soon";
    case "closed":
      return "Registration closed";
    case "external":
      return "Register externally";
    case "tickets":
      return "Tickets";
    case "ended":
      return "Event ended";
    default:
      return "No registration needed";
  }
}
