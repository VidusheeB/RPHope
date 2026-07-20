import type { Metadata } from "next";
import Eyebrow from "@/components/site/Eyebrow";
import CTAButton from "@/components/site/CTAButton";
import {
  SourcesList,
  EducationalDisclaimer,
  type Source,
} from "@/components/site/ExplainerNotes";

export const metadata: Metadata = {
  title: "What is a clinical trial?",
  description:
    "A clear, everyday-language explainer of clinical trials — what they are, the phases, what 'recruiting' vs 'active' means, and how to think about which studies may be relevant to review.",
};

// Educational explainer summarizing standard clinical-trial concepts from
// ClinicalTrials.gov (NIH) and the FDA. Contains medical/research content, so
// it carries an educational disclaimer and cited sources. Framing deliberately
// mirrors the Clinical Trials Finder's governance: studies "may be relevant to
// review," never eligibility. Verify wording before treating as final copy.
const sources: Source[] = [
  {
    label: "ClinicalTrials.gov (NIH) — Study Basics & Glossary",
    href: "https://clinicaltrials.gov/study-basics/glossary",
  },
  {
    label: "ClinicalTrials.gov (NIH) — How to Join a Study",
    href: "https://clinicaltrials.gov/find-studies/for-patients/how-to-join",
  },
  {
    label: "FDA — What Are Clinical Trials and Studies?",
    href: "https://www.fda.gov/patients/clinical-trials-what-patients-need-know",
  },
];

const phases = [
  {
    name: "Phase 1",
    body: "A small group of people. The main question is safety — is the treatment safe, and what's a safe dose?",
  },
  {
    name: "Phase 2",
    body: "A larger group. Does the treatment seem to work, and what are the side effects?",
  },
  {
    name: "Phase 3",
    body: "A much larger group, often compared against existing care. Confirms whether it works and watches for less common effects.",
  },
  {
    name: "Phase 4",
    body: "After approval. Tracks long-term safety and effectiveness in everyday use.",
  },
];

const statuses = [
  {
    label: "Recruiting",
    body: "Actively looking for and enrolling new participants right now.",
    tint: "bg-mint",
  },
  {
    label: "Active, not recruiting",
    body: "The study is running and participants are being followed, but it isn't enrolling new people.",
    tint: "bg-butter",
  },
  {
    label: "Completed",
    body: "The study has finished. Results may or may not be published yet.",
    tint: "bg-lilac",
  },
  {
    label: "Preclinical / research",
    body: "Earlier laboratory or animal research — not yet a study people can join.",
    tint: "bg-cream-header",
  },
];

export default function WhatIsAClinicalTrialPage() {
  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-3xl px-5 py-16">
        <Eyebrow>Understanding research</Eyebrow>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
          What is a{" "}
          <span className="italic font-medium text-gold">clinical trial?</span>
        </h1>
        <p className="mt-6 text-xl leading-relaxed text-ink/80">
          A clinical trial is a carefully run research study that tests whether a
          new treatment is safe and whether it helps. Trials are how promising
          science becomes a treatment doctors can actually use.
        </p>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-medium tracking-tight text-forest">
            Two kinds of studies
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-ink/10 bg-white p-5">
              <h3 className="font-display text-lg font-bold text-ink">
                Interventional (a clinical trial)
              </h3>
              <p className="mt-2 text-ink/80">
                Participants receive a specific treatment — a therapy, medicine,
                or procedure — so researchers can measure its effect.
              </p>
            </div>
            <div className="rounded-lg border border-ink/10 bg-white p-5">
              <h3 className="font-display text-lg font-bold text-ink">
                Observational
              </h3>
              <p className="mt-2 text-ink/80">
                Researchers follow people over time and record what happens,
                without giving a new treatment. These build knowledge that makes
                future trials possible.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-medium tracking-tight text-forest">
            The phases of a trial
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-ink/80">
            Trials usually move through stages, each answering a bigger question
            with more people.
          </p>
          <ol className="mt-4 space-y-3">
            {phases.map((p) => (
              <li
                key={p.name}
                className="flex gap-4 rounded-lg border border-ink/10 bg-white p-4"
              >
                <span className="font-display text-lg font-bold text-forest">
                  {p.name}
                </span>
                <span className="text-ink/80">{p.body}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-medium tracking-tight text-forest">
            What a study&rsquo;s status means
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-ink/80">
            When you look at a trial, its status tells you whether people can
            join today.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {statuses.map((s) => (
              <div key={s.label} className={`rounded-lg ${s.tint} p-5`}>
                <h3 className="font-display text-lg font-bold text-ink">
                  {s.label}
                </h3>
                <p className="mt-2 text-ink/80">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-lg bg-forest p-8 text-cream">
          <h2 className="font-display text-2xl font-medium tracking-tight">
            &ldquo;May be relevant to review&rdquo; — not &ldquo;you
            qualify&rdquo;
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-cream/90">
            Every trial has detailed eligibility criteria — who can and
            can&rsquo;t take part. Only the study team can confirm whether a
            trial fits you. RP Hope&rsquo;s job is to help you{" "}
            <strong className="font-semibold text-white">find studies</strong>{" "}
            worth looking into and understand{" "}
            <strong className="font-semibold text-white">why</strong> they might
            be relevant — never to tell you that you&rsquo;re eligible. Always
            bring a trial to your own eye doctor and the study team.
          </p>
        </section>

        <EducationalDisclaimer />

        <p className="mt-4 text-sm text-ink/55">Last reviewed: July 2026</p>

        <SourcesList sources={sources} />

        <div className="mt-12 flex flex-wrap gap-4">
          <CTAButton href="/clinical-trials" variant="primary" arrow>
            Open the Clinical Trials Finder
          </CTAButton>
          <CTAButton href="/genetic-insights" variant="secondary" arrow>
            Back to Genetic Insights
          </CTAButton>
        </div>
      </div>
    </div>
  );
}
