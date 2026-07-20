import type { Metadata } from "next";
import Image from "next/image";
import CTAButton from "@/components/site/CTAButton";

export const metadata: Metadata = {
  title: "Who We Are — RP Hope",
  description:
    "The mission, vision, and story behind RP Hope — a nonprofit educating and funding research toward treatments for retinitis pigmentosa.",
};

// Content faithful to the original Wix "Who We Are" page (Mission / Vision /
// Fundraising), restyled in the current brand. Contact details match the site
// footer: P.O. Box 1163, Pleasanton, CA · information@rphope.org · 925.209.1440.
const board = ["Lyndon Elam", "Tim Geistlinger", "Kevin Unger", "Eric Elam"];

const pillars = [
  {
    heading: "Mission",
    body: "We serve to educate and fund research in pursuit of effective and affordable treatments for retinitis pigmentosa (RP). RP Hope is a resource for those affected by RP and looking for information about this rare genetic retinal disease.",
    tint: "bg-mint",
  },
  {
    heading: "Vision",
    body: "A world where treatments for RP are operative, effective, and accessible to all patients.",
    tint: "bg-butter",
  },
  {
    heading: "Fundraising",
    body: "Funds raised go toward research seeking treatments for non-syndromic retinitis pigmentosa.",
    tint: "bg-lilac",
  },
];

export default function WhoWeArePage() {
  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-4xl px-5 py-16">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <Image
            src="/home/logo.png"
            alt="RP Hope logo"
            width={96}
            height={96}
            priority
            className="h-24 w-24 rounded-full"
          />
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-forest">
              Who We Are
            </p>
            <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
              Hope, grounded in{" "}
              <span className="italic font-medium text-gold">research.</span>
            </h1>
          </div>
        </div>

        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink/75">
          RP Hope is a nonprofit for everyone touched by retinitis pigmentosa —
          patients, families, caregivers, researchers, and clinicians. We gather
          clear information and fund the science working toward treatments.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {pillars.map((p) => (
            <section
              key={p.heading}
              className={`rounded-lg ${p.tint} p-6`}
            >
              <h2 className="font-display text-xl font-bold text-ink">
                {p.heading}
              </h2>
              <p className="mt-3 text-ink/80">{p.body}</p>
            </section>
          ))}
        </div>

        <section id="board" className="mt-14 scroll-mt-24">
          <h2 className="font-display text-2xl font-medium tracking-tight text-ink">
            Board of Directors
          </h2>
          {/* Names transcribed from the live Wix page. The originals link to each
              director's LinkedIn; those URLs weren't in the scrape, so they are
              rendered as plain names rather than invented links. */}
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {board.map((person) => (
              <li
                key={person}
                className="rounded-lg bg-cream-header px-4 py-3 font-semibold text-ink"
              >
                {person}
              </li>
            ))}
          </ul>
        </section>

        <section
          id="tax-filings"
          className="mt-14 scroll-mt-24 rounded-lg border border-ink/10 bg-white p-8"
        >
          <h2 className="font-display text-2xl font-medium tracking-tight text-ink">
            Tax Filings
          </h2>
          <p className="mt-3 text-ink/75">
            RP Hope&rsquo;s annual filings are available to download.
          </p>
          <p className="mt-5 font-mono text-sm text-ink/55">
            RP Hope · EIN 86-3745576 · 501(c)(3) nonprofit
          </p>
        </section>

        <div className="mt-12 flex flex-wrap gap-4">
          <CTAButton href="/transparency" variant="primary" arrow>
            View annual filings
          </CTAButton>
          <CTAButton href="/contact" variant="secondary" arrow>
            Contact us
          </CTAButton>
        </div>
      </div>
    </div>
  );
}
