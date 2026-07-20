import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Disclaimer — RP Hope" };

// Target for the "Full Disclaimer" link in the site-wide "Before You Continue"
// gate (components/site/MedicalDisclaimerGate.tsx). The wording below mirrors
// the gate itself. TODO: replace with RP Hope's full reviewed disclaimer text —
// this is a stub in the same spirit as /terms-of-use and /privacy-policy.
export default function DisclaimerPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="font-display text-4xl font-medium tracking-tight text-ink">
        Disclaimer
      </h1>

      <div className="mt-6 space-y-4 text-lg leading-relaxed text-ink/80">
        <p>
          RP Hope provides general educational information and does not offer
          medical advice. Community posts reflect individual users&rsquo; views,
          and external links are not controlled or endorsed by RP Hope.
        </p>
        <p>
          By using this site, you acknowledge that you should consult a
          qualified professional before making medical or other important
          decisions.
        </p>
        <p>
          Nothing on this site is a diagnosis, a treatment recommendation, or a
          substitute for care from a qualified clinician. Information about
          genes, research, and clinical trials is shared for education and
          navigation only. Clinical trial listings come from public registries;
          only a study team can confirm whether a trial is appropriate for you.
        </p>
      </div>

      <p className="mt-8 text-ink/75">
        Questions? Email{" "}
        <a
          className="font-semibold text-forest underline"
          href="mailto:information@rphope.org"
        >
          information@rphope.org
        </a>
        .
      </p>

      <p className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-forest">
        <Link href="/terms-of-use" className="underline">
          Terms of Use
        </Link>
        <Link href="/privacy-policy" className="underline">
          Privacy Policy
        </Link>
      </p>
    </div>
  );
}
