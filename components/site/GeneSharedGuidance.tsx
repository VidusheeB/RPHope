// Universal guidance shown on EVERY gene page.
//
// This exists so the generator stops writing it. Near-identical caregiver
// advice, accessibility guidance and RP Hope resource links appeared on every
// earlier draft — the same paragraphs, reworded slightly, costing 150-200 words
// per page and making the writing feel machine-produced. It is the same for
// every gene, so it belongs in one static component, not in generated prose.
//
// The generator now writes `forFamilyAndCaregivers` only when a gene has
// genuinely distinct considerations (hearing loss, organ monitoring, childhood
// onset, syndromic features, inheritance implications). See prompts.ts.
//
// Collapsed by default: a reader who has just received a gene result wants the
// gene-specific content first. It is a real <details>, so it is keyboard
// operable and screen readers announce its expanded state without any ARIA.

import Link from "next/link";

const SUPPORT = [
  {
    heading: "Ask before helping",
    body: "People differ widely in what assistance they want, and it changes by task and by day. Asking first respects that, and avoids help that gets in the way.",
  },
  {
    heading: "Low-vision rehabilitation",
    body: "Low-vision specialists work on practical skills and tools for the sight someone has — lighting, contrast, magnification, orientation and mobility.",
  },
  {
    heading: "Accessible technology",
    body: "Screen readers, magnification, high-contrast modes and voice control are built into phones and computers. Small settings changes often help sooner than new equipment.",
  },
  {
    heading: "School and work",
    body: "Accommodations are often available well before vision loss is severe. Starting the conversation early usually makes it easier.",
  },
  {
    heading: "Emotional and community support",
    body: "A genetic result affects the whole family. Connecting with others living with RP helps people feel less alone with it.",
  },
  {
    heading: "Genetic counselling",
    body: "A genetic counsellor can explain what a result means for relatives, and what testing options exist, without anyone being pushed into a decision.",
  },
];

export default function GeneSharedGuidance() {
  return (
    <details className="mt-8 rounded-lg border border-ink/12 bg-cream/60">
      <summary className="cursor-pointer px-5 py-4 font-semibold text-ink marker:text-forest">
        Support, accessibility and family guidance
        <span className="ml-2 font-normal text-ink/60">
          (the same for every gene)
        </span>
      </summary>

      <div className="border-t border-ink/10 px-5 py-5">
        <p className="text-ink/80">
          This guidance applies to anyone living with an inherited retinal
          condition, whichever gene is involved. Anything specific to this gene
          is in the section above.
        </p>

        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          {SUPPORT.map((item) => (
            <div key={item.heading}>
              <dt className="font-semibold text-forest">{item.heading}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-ink/80">
                {item.body}
              </dd>
            </div>
          ))}
        </dl>

        <nav aria-label="RP Hope resources" className="mt-6 border-t border-ink/10 pt-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-forest/80">
            RP Hope resources
          </h3>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <li>
              <Link href="/my-pathway" className="font-medium text-forest underline">
                Your RP Hope Journey
              </Link>
            </li>
            <li>
              <Link href="/clinical-trials" className="font-medium text-forest underline">
                Clinical Trials Finder
              </Link>
            </li>
            <li>
              <Link href="/newly-diagnosed" className="font-medium text-forest underline">
                Newly diagnosed
              </Link>
            </li>
            <li>
              <Link href="/stories" className="font-medium text-forest underline">
                Patient stories
              </Link>
            </li>
            <li>
              <Link href="/what-is-rp" className="font-medium text-forest underline">
                Understanding RP
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </details>
  );
}
