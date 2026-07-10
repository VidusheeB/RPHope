import type { Metadata } from "next";
import DonateForm from "@/components/site/DonateForm";
import Eyebrow from "@/components/site/Eyebrow";

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

            <DonateForm />
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
