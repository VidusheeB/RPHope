import type { Metadata } from "next";
import Eyebrow from "@/components/site/Eyebrow";
import { STRIPE_DONATE_URL } from "@/lib/donate";

export const metadata: Metadata = {
  title: "Donate — RP Hope",
  description:
    "Support RP Hope. Your donation funds research toward treatments for retinitis pigmentosa.",
};

export default function DonatePage() {
  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-5xl px-5 py-16">
        <Eyebrow>Support our work</Eyebrow>
        <h1 className="mt-5 font-display text-5xl font-medium tracking-tight text-ink">
          Support RP Hope
        </h1>

        <div className="mt-12 grid gap-12 lg:grid-cols-2">
          <section>
            <h2 className="font-display text-2xl font-medium tracking-tight text-ink">
              Online Donation
            </h2>
            <p className="mt-3 text-ink/75">
              Your donation funds researchers working toward therapies to halt the
              progression of RP and supporting newly diagnosed families.
            </p>

            <a
              href={STRIPE_DONATE_URL}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-forest px-6 py-3.5 text-base font-bold text-white transition hover:bg-forest-dark focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2"
            >
              Donate now
              <span aria-hidden="true">→</span>
            </a>
            <p className="mt-3 text-sm text-ink/70">
              You&rsquo;ll choose your amount on Stripe&rsquo;s secure payment page.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium tracking-tight text-ink">
              Mail Your Donation
            </h2>
            <p className="mt-4 text-ink/75">
              To pay by <span className="font-semibold text-ink">check</span>, send
              any amount to:
            </p>
            <address className="mt-4 rounded-lg border border-ink/12 bg-white p-5 not-italic text-lg font-medium text-forest">
              RP Hope
              <br />
              P.O. Box 1163
              <br />
              Pleasanton, CA 94566
            </address>
            <p className="mt-5 text-ink/75">Make checks payable to “RP Hope.”</p>
            <p className="mt-2 text-ink/75">
              If you have questions, email{" "}
              <a
                className="font-semibold text-forest underline hover:text-forest-dark"
                href="mailto:information@rphope.org"
              >
                information@rphope.org
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
