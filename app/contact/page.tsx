import type { Metadata } from "next";
import Eyebrow from "@/components/site/Eyebrow";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact Us — RP Hope",
  description:
    "Get in touch with RP Hope — ask a question, offer to volunteer, or tell us how we can help.",
};

// Recreation of the Wix "Contact Us" page (an About sub-page).
//
// ⚠️ ADDRESS CONFLICT — needs confirming. The live Wix contact page reads
// "Mission Viejo, CA 92692" (see reference/content/pages/contact-us.md), which
// is what is used here. The site footer and /who-we-are instead carry
// "P.O. Box 1163, Pleasanton, CA 94566". One of these is out of date.
export default function ContactPage() {
  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-3xl px-5 py-16">
        <Eyebrow>Who We Are</Eyebrow>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
          Contact <span className="italic font-medium text-gold">Us</span>
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-ink/80">
          Questions, ideas, or want to get involved? Send us a note and
          we&rsquo;ll be in touch shortly.
        </p>

        <address className="mt-6 not-italic text-ink/80">
          Mission Viejo, CA 92692 &nbsp;|&nbsp;{" "}
          <a
            href="mailto:information@rphope.org"
            className="font-semibold text-forest underline"
          >
            information@rphope.org
          </a>
        </address>

        <ContactForm />
      </div>
    </div>
  );
}
