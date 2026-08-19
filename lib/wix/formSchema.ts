// Maps Wix's registration-form definition into renderable fields, and validates
// a visitor's answers back against that same definition.
//
// Wix owns the questions: Carin adds, removes, re-labels, or re-options them in
// the Wix dashboard and both the rendered form and the server-side validation
// follow automatically. Nothing about the question set is hardcoded here.

import type { wixEventsV2 } from "@wix/events";
import type { RegistrationField, RegistrationFieldKind } from "./types";

type InputControl = wixEventsV2.InputControl;

/**
 * Wix sends guest names as a TEXT_ARRAY under a GUEST_CONTROL control. It is
 * submitted through `additionalGuestDetails` rather than as a plain form value,
 * so it is singled out by name in a couple of places.
 */
export const GUEST_NAMES_INPUT = "guestNames";

function kindFor(control: InputControl, inputName: string, valueType?: string): RegistrationFieldKind {
  switch (control.type) {
    case "TEXTAREA":
      return "textarea";
    case "DROPDOWN":
      return "dropdown";
    case "RADIO":
      return "radio";
    case "CHECKBOX":
      return "checkbox";
    case "DATE":
      return "date";
    case "ADDRESS_SHORT":
    case "ADDRESS_FULL":
      return "address";
    case "GUEST_CONTROL":
      return "guestNames";
    default:
      break;
  }
  if (valueType === "TEXT_ARRAY") return "guestNames";
  // Wix models email as a plain INPUT; use the stable input name to get the
  // right keyboard and browser validation on mobile.
  if (inputName.toLowerCase() === "email") return "email";
  return "text";
}

/** Flatten Wix `form.controls[].inputs[]` into an ordered list of questions. */
export function toRegistrationFields(controls: InputControl[] | undefined): RegistrationField[] {
  if (!controls) return [];

  return [...controls]
    .filter((c) => !c.deleted)
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
    .flatMap((control) =>
      (control.inputs ?? []).flatMap((input): RegistrationField[] => {
        const inputName = input.name;
        if (!inputName) return [];
        return [
          {
            inputName,
            label: input.label?.trim() || inputName,
            kind: kindFor(control, inputName, input.type),
            required: Boolean(input.mandatory),
            options: input.options ?? [],
            maxLength: input.maxLength,
            maxSize: input.maxSize ?? undefined,
          },
        ];
      }),
    );
}

export type FieldErrors = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate submitted answers against the live Wix field definitions.
 *
 * Runs server-side against a form definition re-fetched from Wix, so a stale
 * browser tab cannot submit against questions that have since changed. Returns
 * per-field messages keyed by `inputName` so the UI can attach each one to its
 * own input for screen readers.
 */
export function validateAnswers(
  fields: RegistrationField[],
  values: Record<string, string | string[]>,
): FieldErrors {
  const errors: FieldErrors = {};

  for (const field of fields) {
    const raw = values[field.inputName];

    if (field.kind === "guestNames") {
      const names = (Array.isArray(raw) ? raw : []).map((n) => n.trim()).filter(Boolean);
      // Wix rejects the RSVP outright if guestCount > 0 without matching names.
      if (field.maxSize != null && names.length > field.maxSize) {
        errors[field.inputName] = `You can add up to ${field.maxSize} additional ${
          field.maxSize === 1 ? "guest" : "guests"
        }.`;
      }
      continue;
    }

    if (field.kind === "checkbox") {
      const selected = Array.isArray(raw) ? raw.filter(Boolean) : raw ? [raw] : [];
      if (field.required && selected.length === 0) {
        errors[field.inputName] = `${field.label} is required.`;
        continue;
      }
      const invalid = selected.find((v) => field.options.length > 0 && !field.options.includes(v));
      if (invalid) errors[field.inputName] = `Choose an option for ${field.label}.`;
      continue;
    }

    const value = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

    if (!value) {
      if (field.required) errors[field.inputName] = `${field.label} is required.`;
      continue;
    }
    if (field.maxLength != null && value.length > field.maxLength) {
      errors[field.inputName] = `${field.label} must be ${field.maxLength} characters or fewer.`;
      continue;
    }
    if (field.kind === "email" && !EMAIL_RE.test(value)) {
      errors[field.inputName] = "Enter a valid email address.";
      continue;
    }
    if (
      (field.kind === "dropdown" || field.kind === "radio") &&
      field.options.length > 0 &&
      !field.options.includes(value)
    ) {
      errors[field.inputName] = `Choose one of the listed options for ${field.label}.`;
    }
  }

  return errors;
}

/** Pull the identity fields Wix requires as top-level RSVP properties. */
export function extractIdentity(values: Record<string, string | string[]>): {
  firstName: string;
  lastName: string;
  email: string;
} {
  const one = (key: string): string => {
    const raw = values[key];
    return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  };
  return { firstName: one("firstName"), lastName: one("lastName"), email: one("email") };
}
