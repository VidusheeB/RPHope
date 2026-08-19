// Narrow internal types for the slice of Wix Events this site actually renders.
// Wix's own `Event` type is enormous and almost entirely optional; mapping into
// these keeps the UI honest about what is really guaranteed to be present.

/** What a visitor can actually do about registration right now. */
export type RegistrationState =
  | "open" // RSVP accepted
  | "waitlist" // guest limit reached, waitlist accepting
  | "scheduled" // RSVP opens at a future date
  | "closed" // closed manually, automatically, or paused
  | "external" // Carin pointed registration at another platform
  | "tickets" // paid/ticketed event (checkout not built here yet)
  | "none" // display-only event
  | "ended"; // event is over or canceled

export type RegistrationFieldKind =
  | "text"
  | "textarea"
  | "email"
  | "dropdown"
  | "radio"
  | "checkbox"
  | "date"
  | "address"
  | "guestNames";

/**
 * One renderable question, flattened from Wix's `form.controls[].inputs[]`.
 * `inputName` is Wix's stable identifier and is what gets submitted back —
 * labels are display-only and may be re-worded in the dashboard at any time.
 */
export type RegistrationField = {
  inputName: string;
  label: string;
  kind: RegistrationFieldKind;
  required: boolean;
  options: string[];
  maxLength?: number;
  maxSize?: number;
};

export type SiteEvent = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  /** Paragraphs extracted from Wix rich content — plain text, never raw HTML. */
  descriptionParagraphs: string[];
  imageUrl: string | null;
  imageAlt: string | null;
  /** ISO strings; null when the organizer marked date/time as TBD. */
  start: string | null;
  end: string | null;
  timeZone: string | null;
  hideEndDate: boolean;
  dateTbd: boolean;
  dateTbdMessage: string | null;
  locationType: "VENUE" | "ONLINE" | null;
  locationName: string | null;
  locationAddress: string | null;
  registrationState: RegistrationState;
  /** Only set when `registrationState === "external"`. */
  externalUrl: string | null;
  /** Whether Wix is configured to accept a "No" response, not just "Yes". */
  allowsNoResponse: boolean;
  /** Populated only on the detail fetch (needs the FORM fieldset). */
  fields: RegistrationField[];
};

/** Outcome of a registration attempt, mapped from Wix's application errors. */
export type RegistrationOutcome =
  | { ok: true; status: "confirmed" | "waitlisted" | "declined" }
  | { ok: false; reason: RegistrationFailure; message: string };

export type RegistrationFailure =
  | "closed"
  | "not_started"
  | "full"
  | "waitlist_unavailable"
  | "already_registered"
  | "invalid_form"
  | "not_found"
  | "wrong_event_type"
  | "unavailable";
