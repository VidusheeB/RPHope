"use client";

import { useState } from "react";

// ⚠️ INTERIM SUBMISSION MECHANISM. The old Wix page posted to Wix's own form
// backend. This app has no email service wired up, so rather than ship a form
// that silently discards messages, submitting opens the visitor's mail client
// with the message pre-filled to information@rphope.org.
//
// To make this a true server-side form we need one of:
//   - an email provider (e.g. Resend) + an /api/contact route, or
//   - a Supabase `contact_messages` table + a notification.
// Until then the address below is always shown as a plain, reliable fallback.
const TO = "information@rphope.org";

const field =
  "w-full rounded-md border border-ink/25 bg-white px-4 py-3 text-ink placeholder:text-ink/50 focus:border-forest focus:outline-none focus:ring-2 focus:ring-gold";

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = `${message}\n\n— ${name}${email ? ` (${email})` : ""}`;
    window.location.href = `mailto:${TO}?subject=${encodeURIComponent(
      subject || "Message from the RP Hope website"
    )}&body=${encodeURIComponent(body)}`;
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="block font-semibold text-ink">
            Name
          </label>
          <input
            id="contact-name"
            name="name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`mt-1.5 ${field}`}
          />
        </div>
        <div>
          <label
            htmlFor="contact-email"
            className="block font-semibold text-ink"
          >
            Email
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`mt-1.5 ${field}`}
          />
        </div>
      </div>

      <div>
        <label htmlFor="contact-subject" className="block font-semibold text-ink">
          Subject
        </label>
        <input
          id="contact-subject"
          name="subject"
          type="text"
          placeholder="Ask us a question, offer to volunteer, etc."
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className={`mt-1.5 ${field}`}
        />
      </div>

      <div>
        <label htmlFor="contact-message" className="block font-semibold text-ink">
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={6}
          required
          placeholder="Type your message here…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={`mt-1.5 ${field}`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-2">
        <button
          type="submit"
          className="inline-flex min-h-[48px] items-center justify-center rounded-md bg-forest px-7 py-3 font-bold text-white transition hover:bg-forest-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
        >
          Send message
        </button>
        <p className="text-sm text-ink/65">
          This opens your email app. You can also write to us directly at{" "}
          <a
            href={`mailto:${TO}`}
            className="font-semibold text-forest underline"
          >
            {TO}
          </a>
          .
        </p>
      </div>
    </form>
  );
}
