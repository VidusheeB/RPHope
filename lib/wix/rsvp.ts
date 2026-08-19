// Creates RSVPs in Wix Events. This is the only write path in the integration:
// the guest lands directly in Carin's normal Wix guest list, and nothing is
// mirrored into Supabase.

import { wixClient } from "./client";
import { GUEST_NAMES_INPUT } from "./formSchema";
import type { RegistrationField, RegistrationFailure, RegistrationOutcome } from "./types";

export type RsvpStatus = "YES" | "NO" | "WAITLIST";

/**
 * Wix's documented application-error codes → a stable internal reason plus the
 * sentence the visitor actually reads. Wix's own strings are developer-facing,
 * so they are never surfaced directly.
 */
const FAILURES: Record<string, { reason: RegistrationFailure; message: string }> = {
  RSVPS_CLOSED: {
    reason: "closed",
    message: "Registration for this event has closed. Please email us — there may still be room.",
  },
  RSVPS_NOT_STARTED: {
    reason: "not_started",
    message: "Registration for this event hasn't opened yet. Please check back soon.",
  },
  GUEST_LIMIT_EXCEEDED: {
    reason: "full",
    message:
      "There aren't enough spots left for that many guests. Try registering fewer guests, or email us.",
  },
  RSVP_LIMIT_EXCEEDED: {
    reason: "full",
    message: "This event is now full. Please email us to ask about a waitlist.",
  },
  WAITING_LIST_UNAVAILABLE: {
    reason: "waitlist_unavailable",
    message: "This event is full and the waitlist isn't open. Please email us.",
  },
  MEMBER_EMAIL_ALREADY_REGISTERED: {
    reason: "already_registered",
    message: "That email address is already registered for this event — you're all set.",
  },
  MEMBER_ALREADY_REGISTERED: {
    reason: "already_registered",
    message: "That email address is already registered for this event — you're all set.",
  },
  ADDITIONAL_GUESTS_MUST_HAVE_NAMES: {
    reason: "invalid_form",
    message: "Please enter a name for each additional guest.",
  },
  INVALID_FORM_RESPONSE: {
    reason: "invalid_form",
    message: "Some answers didn't match what this event is asking for. Please review and try again.",
  },
  UNEXPECTED_RSVP_STATUS: {
    reason: "invalid_form",
    message: "That response isn't available for this event. Please try again.",
  },
  EVENT_NOT_FOUND: {
    reason: "not_found",
    message: "We couldn't find that event. It may have been removed.",
  },
  INVALID_EVENT_TYPE: {
    reason: "wrong_event_type",
    message: "This event doesn't take RSVPs. Please check the event page for how to register.",
  },
  FORM_SUBMISSIONS_NOT_SUPPORTED: {
    reason: "wrong_event_type",
    message: "This event doesn't take RSVPs. Please check the event page for how to register.",
  },
};

const UNAVAILABLE: { reason: RegistrationFailure; message: string } = {
  reason: "unavailable",
  message: "We couldn't complete your registration just now. Please try again in a moment.",
};

/** Wix nests its error code a few levels down; pull it out without assuming shape. */
export function wixErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const e = error as {
    details?: { applicationError?: { code?: string } };
    applicationError?: { code?: string };
  };
  return e.details?.applicationError?.code ?? e.applicationError?.code ?? null;
}

type InputValue = { inputName: string; value?: string; values?: string[] };

function toInputValues(
  fields: RegistrationField[],
  values: Record<string, string | string[]>,
): InputValue[] {
  return fields.flatMap((field): InputValue[] => {
    const raw = values[field.inputName];

    if (field.kind === "guestNames" || field.kind === "checkbox") {
      const list = (Array.isArray(raw) ? raw : raw ? [raw] : [])
        .map((v) => v.trim())
        .filter(Boolean);
      if (list.length === 0) return [];
      return [{ inputName: field.inputName, values: list }];
    }

    const value = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
    if (!value) return [];
    return [{ inputName: field.inputName, value }];
  });
}

export async function createRsvp(params: {
  eventId: string;
  fields: RegistrationField[];
  values: Record<string, string | string[]>;
  status: RsvpStatus;
  identity: { firstName: string; lastName: string; email: string };
}): Promise<RegistrationOutcome> {
  if (!wixClient) return { ok: false, ...UNAVAILABLE };

  const { eventId, fields, values, status, identity } = params;

  // Additional guests ride on `additionalGuestDetails`, which Wix only accepts
  // when the event's form actually has a guest control.
  const guestField = fields.find((f) => f.kind === "guestNames");
  const guestNames = guestField
    ? (Array.isArray(values[guestField.inputName]) ? (values[guestField.inputName] as string[]) : [])
        .map((n) => n.trim())
        .filter(Boolean)
    : [];

  try {
    const rsvp = await wixClient.rsvp.createRsvp({
      eventId,
      firstName: identity.firstName,
      lastName: identity.lastName,
      email: identity.email,
      status,
      form: { inputValues: toInputValues(fields, values) },
      ...(guestField
        ? { additionalGuestDetails: { guestCount: guestNames.length, guestNames } }
        : {}),
    });

    // Wix decides the final state — a "YES" can come back as WAITLIST when the
    // event filled up between the page load and this call.
    const finalStatus = rsvp?.status ?? status;
    return {
      ok: true,
      status:
        finalStatus === "WAITLIST" ? "waitlisted" : finalStatus === "NO" ? "declined" : "confirmed",
    };
  } catch (error) {
    const code = wixErrorCode(error);
    // Log the code only — never the guest's answers.
    console.error(`[wix] createRsvp failed for event ${eventId}: ${code ?? "unknown"}`);
    return { ok: false, ...(code ? FAILURES[code] ?? UNAVAILABLE : UNAVAILABLE) };
  }
}
