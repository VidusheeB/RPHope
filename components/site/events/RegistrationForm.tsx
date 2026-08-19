"use client";

import { useId, useRef, useState } from "react";
import type { RegistrationField, SiteEvent } from "@/lib/wix/types";

const inputClass =
  "w-full rounded-md border border-ink/25 bg-white px-4 py-3 text-ink placeholder:text-ink/50 focus:border-forest focus:outline-none focus:ring-2 focus:ring-gold";

type Values = Record<string, string | string[]>;

type Result =
  | { kind: "confirmed" | "waitlisted" | "declined" }
  | { kind: "error"; message: string };

export default function RegistrationForm({ event }: { event: SiteEvent }) {
  const formId = useId();
  const [values, setValues] = useState<Values>({});
  const [guestCount, setGuestCount] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  // Blocks a duplicate POST from a fast double-click, before React re-renders
  // the disabled button.
  const inFlight = useRef(false);

  const isWaitlist = event.registrationState === "waitlist";
  const guestField = event.fields.find((f) => f.kind === "guestNames");
  const questions = event.fields.filter((f) => f.kind !== "guestNames");

  const setValue = (name: string, value: string | string[]) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  async function handleSubmit(e: React.FormEvent, status: "YES" | "NO") {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setFieldErrors({});
    setResult(null);

    const payload: Values = { ...values };
    if (guestField) {
      payload[guestField.inputName] = Array.from({ length: guestCount }, (_, i) =>
        String((values[`__guest_${i}`] as string) ?? "").trim(),
      );
    }
    // Internal-only guest-name scratch keys never go to the server.
    Object.keys(payload).forEach((k) => k.startsWith("__guest_") && delete payload[k]);

    try {
      const res = await fetch(`/api/events/${event.id}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: payload, status }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data?.fieldErrors) setFieldErrors(data.fieldErrors);
        setResult({
          kind: "error",
          message: data?.error || "We couldn't complete your registration. Please try again.",
        });
      } else {
        setResult({ kind: data.status ?? "confirmed" });
      }
    } catch {
      setResult({
        kind: "error",
        message: "We couldn't reach the registration service. Please check your connection and try again.",
      });
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  if (result && result.kind !== "error") {
    return <SuccessPanel kind={result.kind} event={event} />;
  }

  return (
    <form
      onSubmit={(e) => handleSubmit(e, "YES")}
      className="rounded-lg border border-ink/10 bg-white p-6"
      noValidate
    >
      <h2 className="font-display text-2xl font-medium tracking-tight text-ink">
        {isWaitlist ? "Join the waitlist" : "Register for this event"}
      </h2>
      {isWaitlist && (
        <p className="mt-2 text-ink/75">
          This event has reached its guest limit. Add your details and the organizers will be in
          touch if a spot opens up.
        </p>
      )}
      <p className="mt-2 text-sm text-ink/70">
        Fields marked <span aria-hidden="true">*</span>
        <span className="sr-only">required</span> are required.
      </p>

      {result?.kind === "error" && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-red-700/30 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
        >
          {result.message}
        </p>
      )}

      <div className="mt-6 space-y-5">
        {questions.map((field) => (
          <Field
            key={field.inputName}
            field={field}
            formId={formId}
            value={values[field.inputName]}
            error={fieldErrors[field.inputName]}
            onChange={(v) => setValue(field.inputName, v)}
          />
        ))}

        {guestField && (
          <GuestControl
            field={guestField}
            formId={formId}
            count={guestCount}
            error={fieldErrors[guestField.inputName]}
            names={Array.from({ length: guestCount }, (_, i) => (values[`__guest_${i}`] as string) ?? "")}
            onCountChange={setGuestCount}
            onNameChange={(i, v) => setValue(`__guest_${i}`, v)}
          />
        )}
      </div>

      <div className="mt-7 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-forest px-6 py-3.5 text-base font-bold text-white transition hover:bg-forest-dark focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Sending…" : isWaitlist ? "Join the waitlist" : "Complete registration"}
        </button>

        {event.allowsNoResponse && !isWaitlist && (
          <button
            type="button"
            disabled={submitting}
            onClick={(e) => handleSubmit(e, "NO")}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/30 px-6 py-3.5 text-base font-bold text-ink transition hover:border-ink hover:bg-ink/5 focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            I can&rsquo;t attend
          </button>
        )}
      </div>

      <p aria-live="polite" className="sr-only">
        {submitting ? "Sending your registration" : ""}
      </p>
    </form>
  );
}

function SuccessPanel({
  kind,
  event,
}: {
  kind: "confirmed" | "waitlisted" | "declined";
  event: SiteEvent;
}) {
  const copy = {
    confirmed: {
      title: "You're registered.",
      body: "We've saved your spot and a confirmation email is on its way.",
    },
    waitlisted: {
      title: "You're on the waitlist.",
      body: "We'll email you if a spot opens up for this event.",
    },
    declined: {
      title: "Thanks for letting us know.",
      body: "We've recorded that you can't attend this one. We hope to see you at the next.",
    },
  }[kind];

  return (
    <div
      role="status"
      className="rounded-lg border border-forest/25 bg-mint p-6"
      // Moves screen-reader focus to the outcome instead of leaving it on a
      // button that no longer exists.
      tabIndex={-1}
      ref={(node) => node?.focus()}
    >
      <h2 className="font-display text-2xl font-medium tracking-tight text-forest">{copy.title}</h2>
      <p className="mt-2 text-ink/80">{copy.body}</p>
      <dl className="mt-4 text-ink/80">
        <dt className="sr-only">Event</dt>
        <dd className="font-semibold">{event.title}</dd>
      </dl>
    </div>
  );
}

function Field({
  field,
  formId,
  value,
  error,
  onChange,
}: {
  field: RegistrationField;
  formId: string;
  value: string | string[] | undefined;
  error?: string;
  onChange: (value: string | string[]) => void;
}) {
  const id = `${formId}-${field.inputName}`;
  const errorId = `${id}-error`;
  const single = (Array.isArray(value) ? value[0] : value) ?? "";
  const describedBy = error ? errorId : undefined;

  const label = (
    <span>
      {field.label}
      {field.required && (
        <>
          <span aria-hidden="true" className="text-red-700">
            {" "}
            *
          </span>
          <span className="sr-only"> (required)</span>
        </>
      )}
    </span>
  );

  // Radio and checkbox groups need a fieldset/legend rather than a single label.
  if ((field.kind === "radio" || field.kind === "checkbox") && field.options.length > 0) {
    const selected = Array.isArray(value) ? value : value ? [value] : [];
    return (
      <fieldset aria-describedby={describedBy} aria-invalid={error ? true : undefined}>
        <legend className="mb-2 block font-semibold text-ink">{label}</legend>
        <div className="space-y-2">
          {field.options.map((option) => {
            const optionId = `${id}-${option.replace(/\W+/g, "-")}`;
            const checked =
              field.kind === "radio" ? single === option : selected.includes(option);
            return (
              <div key={option} className="flex items-center gap-2">
                <input
                  id={optionId}
                  type={field.kind === "radio" ? "radio" : "checkbox"}
                  name={id}
                  value={option}
                  checked={checked}
                  onChange={(e) => {
                    if (field.kind === "radio") return onChange(option);
                    const next = e.target.checked
                      ? [...selected, option]
                      : selected.filter((v) => v !== option);
                    onChange(next);
                  }}
                  className="h-5 w-5 accent-forest focus:outline-none focus:ring-2 focus:ring-gold"
                />
                <label htmlFor={optionId} className="text-ink">
                  {option}
                </label>
              </div>
            );
          })}
        </div>
        <FieldError id={errorId} message={error} />
      </fieldset>
    );
  }

  return (
    <div>
      <label htmlFor={id} className="mb-2 block font-semibold text-ink">
        {label}
      </label>

      {field.kind === "textarea" ? (
        <textarea
          id={id}
          rows={4}
          maxLength={field.maxLength}
          required={field.required}
          aria-required={field.required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          value={single}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      ) : field.kind === "dropdown" && field.options.length > 0 ? (
        <select
          id={id}
          required={field.required}
          aria-required={field.required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          value={single}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          <option value="">Select an option</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={field.kind === "email" ? "email" : field.kind === "date" ? "date" : "text"}
          maxLength={field.maxLength}
          required={field.required}
          aria-required={field.required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          value={single}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}

      <FieldError id={errorId} message={error} />
    </div>
  );
}

function GuestControl({
  field,
  formId,
  count,
  names,
  error,
  onCountChange,
  onNameChange,
}: {
  field: RegistrationField;
  formId: string;
  count: number;
  names: string[];
  error?: string;
  onCountChange: (n: number) => void;
  onNameChange: (index: number, value: string) => void;
}) {
  const id = `${formId}-guests`;
  const errorId = `${id}-error`;
  const max = field.maxSize ?? 10;

  return (
    <fieldset>
      <legend className="mb-2 block font-semibold text-ink">{field.label}</legend>
      <label htmlFor={id} className="mb-2 block text-sm text-ink/75">
        How many additional guests are you bringing?
      </label>
      <select
        id={id}
        value={count}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onCountChange(Number(e.target.value))}
        className={inputClass}
      >
        {Array.from({ length: max + 1 }, (_, i) => (
          <option key={i} value={i}>
            {i}
          </option>
        ))}
      </select>

      {count > 0 && (
        <div className="mt-4 space-y-3">
          {Array.from({ length: count }, (_, i) => {
            const guestId = `${id}-name-${i}`;
            return (
              <div key={i}>
                <label htmlFor={guestId} className="mb-1 block text-sm font-semibold text-ink">
                  Guest {i + 1} full name
                  <span aria-hidden="true" className="text-red-700">
                    {" "}
                    *
                  </span>
                  <span className="sr-only"> (required)</span>
                </label>
                <input
                  id={guestId}
                  type="text"
                  required
                  aria-required
                  value={names[i] ?? ""}
                  onChange={(e) => onNameChange(i, e.target.value)}
                  className={inputClass}
                />
              </div>
            );
          })}
        </div>
      )}

      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-2 text-sm font-semibold text-red-800">
      {message}
    </p>
  );
}
