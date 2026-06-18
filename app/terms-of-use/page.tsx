import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Use — RP Hope" };

export default function TermsOfUsePage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="font-display text-4xl font-bold text-ink">Terms of Use</h1>
      <p className="mt-5 text-ink/75">
        This page will hold RP Hope&rsquo;s terms of use. RP Hope&rsquo;s content is for
        education and navigation only and is not medical advice, diagnosis, or
        treatment. Always consult a qualified clinician about your care.
      </p>
    </div>
  );
}
