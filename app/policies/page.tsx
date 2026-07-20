import type { Metadata } from "next";
import Eyebrow from "@/components/site/Eyebrow";

export const metadata: Metadata = {
  title: "Policies & Disclaimers — RP Hope",
  description:
    "RP Hope's full disclaimer, terms of use, and privacy policy in one place.",
};

// Single canonical home for RP Hope's legal copy. The site-wide "Before You
// Continue" gate links here by anchor (#disclaimer, #terms, #privacy), as does
// the footer. /disclaimer, /terms-of-use and /privacy-policy redirect here so
// there is exactly ONE copy of this text to keep current.
//
// ⚠️ AWAITING FINAL TEXT. The Disclaimer section below is the wording already
// approved for the gate. Terms and Privacy carry the previous placeholder copy
// and must be replaced with RP Hope's real reviewed text before launch.
const sections = [
  {
    id: "disclaimer",
    heading: "Full Disclaimer",
    pending: false,
    paragraphs: [
      "RP Hope provides general educational information and does not offer medical advice. Community posts reflect individual users’ views, and external links are not controlled or endorsed by RP Hope.",
      "By using this site, you acknowledge that you should consult a qualified professional before making medical or other important decisions.",
      "Nothing on this site is a diagnosis, a treatment recommendation, or a substitute for care from a qualified clinician. Information about genes, research, and clinical trials is shared for education and navigation only. Clinical trial listings come from public registries; only a study team can confirm whether a trial is appropriate for you.",
    ],
  },
  {
    id: "terms",
    heading: "Terms of Use",
    pending: true,
    paragraphs: [
      "RP Hope’s content is for education and navigation only and is not medical advice, diagnosis, or treatment. Always consult a qualified clinician about your care.",
    ],
  },
  {
    id: "privacy",
    heading: "Privacy Policy",
    pending: true,
    paragraphs: [
      "RP Hope respects your privacy. We collect only what we need to operate the site and our mailing list, and we never sell your information.",
    ],
  },
];

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
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="underline underline-offset-2">
                  {s.heading}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-12 space-y-12">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="font-display text-2xl font-medium tracking-tight text-forest">
                {s.heading}
              </h2>
              {s.pending && (
                <p className="mt-3 rounded-lg border border-gold/40 bg-butter p-3 text-sm font-semibold text-ink/80">
                  Full text coming soon — the summary below is a placeholder.
                </p>
              )}
              <div className="mt-3 space-y-3 text-lg leading-relaxed text-ink/80">
                {s.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-12 text-ink/75">
          Questions about any of the above? Email{" "}
          <a
            className="font-semibold text-forest underline"
            href="mailto:information@rphope.org"
          >
            information@rphope.org
          </a>
          .
        </p>
      </div>
    </div>
  );
}
