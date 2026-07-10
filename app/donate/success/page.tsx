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
        A receipt has been emailed to you by Stripe. If you have any questions,
        reach us at{" "}
        <a
          className="font-semibold text-forest underline hover:text-forest-dark"
          href="mailto:information@rphope.org"
        >
          information@rphope.org
        </a>
        .
      </p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-md bg-forest px-6 py-3 font-bold text-white hover:bg-forest-dark"
      >
        Return home
      </Link>
    </div>
  );
}
