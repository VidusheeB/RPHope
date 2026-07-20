import type { Metadata } from "next";
import Eyebrow from "@/components/site/Eyebrow";
import { LEGAL_SECTIONS, type LegalBlock } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Policies & Disclaimers — RP Hope",
  description:
    "RP Hope's disclaimer, terms & conditions, and privacy policy in one place.",
};

// Single canonical home for RP Hope's legal copy. The site-wide "Before You
// Continue" gate and the footer link here by anchor (#disclaimer, #terms,
// #privacy); /disclaimer, /terms-of-use and /privacy-policy redirect here
// (next.config.mjs) so there is exactly ONE copy of this text to keep current.
//
// The text itself lives in lib/legal.ts and is reproduced verbatim — this file
// only handles presentation.
function Block({ block }: { block: LegalBlock }) {
  if (block.type === "h3") {
    return (
      <h3 className="mt-8 font-display text-xl font-bold text-ink">
        {block.text}
      </h3>
    );
  }
  if (block.type === "ul") {
    return (
      <ul className="mt-3 list-disc space-y-2 pl-6 text-ink/80">
        {block.items.map((item, i) => (
          <li key={i} className="leading-relaxed">
            {item}
          </li>
        ))}
      </ul>
    );
  }
  return <p className="mt-3 leading-relaxed text-ink/80">{block.text}</p>;
}

export default function PoliciesPage() {
  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-3xl px-5 py-16">
        <Eyebrow>Legal</Eyebrow>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
          Policies &amp;{" "}
          <span className="italic font-medium text-gold">Disclaimers</span>
        </h1>

        <nav aria-label="On this page" className="mt-8">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-forest">
            {LEGAL_SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="underline underline-offset-2">
                  {s.heading}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-12 space-y-14">
          {LEGAL_SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="font-display text-2xl font-medium tracking-tight text-forest">
                {section.heading}
              </h2>
              {section.blocks.map((block, i) => (
                <Block key={i} block={block} />
              ))}
            </section>
          ))}
        </div>

        <p className="mt-14 border-t border-ink/10 pt-6 text-ink/75">
          Questions about any of the above? Email{" "}
          <a
            className="font-semibold text-forest underline"
            href="mailto:information@rphope.org"
          >
            information@rphope.org
          </a>{" "}
          or write to P.O. Box 1163, Pleasanton, CA 94566.
        </p>
      </div>
    </div>
  );
}
