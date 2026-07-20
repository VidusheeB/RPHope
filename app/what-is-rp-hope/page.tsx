import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Eyebrow from "@/components/site/Eyebrow";
import CTAButton from "@/components/site/CTAButton";

export const metadata: Metadata = {
  title: "What is RP Hope?",
  description:
    "RP Hope is a nonprofit for everyone touched by retinitis pigmentosa — patients, families, caregivers, researchers, and clinicians. Learn what we do and why.",
};

// Introductory explainer used as an early stop in the guided tour. Content is
// drawn from the existing "Who We Are" page and the homepage — no new medical
// claims here, so no review gate is needed on this page.
const pillars = [
  {
    heading: "Educate",
    body: "We gather clear, jargon-free information about RP — the genes behind it, the science, and where research stands — so no one has to face a rare diagnosis alone or confused.",
    tint: "bg-mint",
  },
  {
    heading: "Fund research",
    body: "Donations go toward research seeking effective, affordable treatments for non-syndromic retinitis pigmentosa.",
    tint: "bg-butter",
  },
  {
    heading: "Connect community",
    body: "Patients, families, caregivers, researchers, and clinicians — RP Hope is a place to find each other, share stories, and gather at events.",
    tint: "bg-lilac",
  },
];

const audience = [
  "People recently diagnosed with RP",
  "Families and caregivers",
  "People living with vision loss",
  "Researchers and clinicians",
  "Supporters and donors",
];

export default function WhatIsRpHopePage() {
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
            <Eyebrow>Start here</Eyebrow>
            <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
              What is{" "}
              <span className="italic font-medium text-gold">RP Hope?</span>
            </h1>
          </div>
        </div>

        <p className="mt-8 max-w-2xl text-xl leading-relaxed text-ink/80">
          RP Hope is a nonprofit for everyone touched by{" "}
          <strong className="font-semibold text-ink">
            retinitis pigmentosa (RP)
          </strong>{" "}
          — a rare, inherited eye disease that gradually affects vision. We bring
          together clear information and fund the science working toward
          treatments.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {pillars.map((p) => (
            <section key={p.heading} className={`rounded-lg ${p.tint} p-6`}>
              <h2 className="font-display text-xl font-bold text-ink">
                {p.heading}
              </h2>
              <p className="mt-3 text-ink/80">{p.body}</p>
            </section>
          ))}
        </div>

        <section className="mt-14 rounded-lg border border-ink/10 bg-white p-8">
          <h2 className="font-display text-2xl font-medium tracking-tight text-ink">
            Who we&rsquo;re for
          </h2>
          <p className="mt-3 text-ink/75">
            Wherever you are on your journey with RP, there&rsquo;s a place for
            you here.
          </p>
          <ul className="mt-5 flex flex-wrap gap-3">
            {audience.map((a) => (
              <li
                key={a}
                className="rounded-full bg-cream-header px-4 py-2 text-sm font-semibold text-forest"
              >
                {a}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8 rounded-lg bg-forest p-8 text-cream">
          <h2 className="font-display text-2xl font-medium tracking-tight">
            The heart of it
          </h2>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-cream/90">
            Our vision is a world where treatments for RP are operative,
            effective, and accessible to <em>all</em> patients. Everything on
            this site — the gene library, the research updates, the clinical
            trials finder — exists to move people closer to that.
          </p>
        </section>

        <div className="mt-12 flex flex-wrap gap-4">
          <CTAButton href="/what-is-rp" variant="primary" arrow>
            Next: What is RP?
          </CTAButton>
          <Link
            href="/who-we-are"
            className="inline-flex items-center gap-2 self-center font-semibold text-forest underline"
          >
            More about who we are →
          </Link>
        </div>
      </div>
    </div>
  );
}
