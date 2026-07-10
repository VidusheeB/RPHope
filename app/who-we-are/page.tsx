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

        <section
          id="contact"
          className="mt-14 scroll-mt-24 rounded-lg border border-ink/10 bg-white p-8"
        >
          <h2 className="font-display text-2xl font-medium tracking-tight text-ink">Contact us</h2>
          <p className="mt-3 text-ink/75">
            Questions, ideas, or want to get involved? We&rsquo;d love to hear
            from you.
          </p>
          <address className="mt-5 space-y-2 not-italic text-ink/80">
            <p>
              <span className="font-semibold text-ink">Email:</span>{" "}
              <a
                href="mailto:information@rphope.org"
                className="font-semibold text-forest underline"
              >
                information@rphope.org
              </a>
            </p>
            <p>
              <span className="font-semibold text-ink">Phone:</span>{" "}
              <a href="tel:+19252091440" className="text-forest underline">
                925.209.1440
              </a>
            </p>
            <p>
              <span className="font-semibold text-ink">Mail:</span> P.O. Box
              1163, Pleasanton, CA 94566
            </p>
          </address>
          <p className="mt-5 font-mono text-sm text-ink/55">
            RP Hope · EIN 86-3745576 · 501(c)(3) nonprofit
          </p>
        </section>

        <div className="mt-12 flex flex-wrap gap-4">
          <CTAButton href="/donate" variant="primary" arrow>
            Support our research
          </CTAButton>
          <CTAButton href="/transparency" variant="secondary" arrow>
            Financial transparency
          </CTAButton>
        </div>
      </div>
    </div>
  );
}
