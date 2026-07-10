import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Donation cancelled — RP Hope",
  description: "Your donation was not completed.",
};

export default function DonateCancelledPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-20 text-center">
      <h1 className="font-display text-4xl font-medium tracking-tight text-ink">
        Donation cancelled
      </h1>
      <p className="mt-4 text-lg text-ink/75">
        No charge was made. If something went wrong, you can try again — every
        gift helps move RP research forward.
      </p>
      <Link
        href="/donate"
        className="mt-8 inline-block rounded-md bg-forest px-6 py-3 font-bold text-white hover:bg-forest-dark"
      >
        Back to donate
      </Link>
    </div>
  );
}
