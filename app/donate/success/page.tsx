import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Thank you — RP Hope",
  description: "Thank you for supporting RP Hope.",
};

export default function DonateSuccessPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-20 text-center">
      <div
        aria-hidden="true"
        className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-forest text-white"
      >
        <svg
          className="h-8 w-8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <h1 className="mt-6 font-display text-4xl font-medium tracking-tight text-ink">
        Thank you
      </h1>
      <p className="mt-4 text-lg text-ink/75">
        Your donation to RP Hope was received. Your support funds researchers
        working toward therapies to halt the progression of retinitis pigmentosa
        — and helps newly diagnosed families find their footing.
      </p>
      <p className="mt-4 text-ink/70">
        Stripe emails your receipt to the address you entered. If you have any
        questions, reach us at{" "}
        <a
          className="font-semibold text-forest underline hover:text-forest-dark"
          href="mailto:information@rphope.org"
        >
          information@rphope.org
        </a>
        .
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="inline-block rounded-md bg-forest px-6 py-3 font-bold text-white hover:bg-forest-dark focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2"
        >
          Return home
        </Link>
        <Link
          href="/events"
          className="inline-block rounded-md border border-ink/30 px-6 py-3 font-bold text-ink hover:border-ink hover:bg-ink/5 focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2"
        >
          See our events
        </Link>
      </div>
    </div>
  );
}
