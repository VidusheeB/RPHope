import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy — RP Hope" };

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="font-display text-4xl font-bold text-ink">Privacy Policy</h1>
      <p className="mt-5 text-ink/75">
        RP Hope respects your privacy. This page will hold our full privacy policy.
        We collect only what we need to operate the site and our mailing list, and
        we never sell your information. For questions, email{" "}
        <a className="font-semibold text-forest underline" href="mailto:information@rphope.org">
          information@rphope.org
        </a>
        .
      </p>
    </div>
  );
}
