import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Donate — RP Hope",
  description:
    "Support RP Hope. Your donation funds research toward treatments for retinitis pigmentosa.",
};

const amounts = ["$20", "$50", "$100", "$200", "$500", "$1,000"];

export default function DonatePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="border-y-4 border-double border-teal py-2 font-display text-4xl font-bold uppercase tracking-tight text-teal-dark">
        Support RP Hope
      </h1>

      <div className="mt-10 grid gap-12 lg:grid-cols-2">
        <section>
          <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-teal-dark">
            Online Donation
          </h2>
          <p className="mt-3 text-teal-dark/90">
            Your donation funds researchers working toward therapies to halt the
            progression of RP and supporting newly diagnosed families.
          </p>

          <form className="mt-6 space-y-6">
            <fieldset>
              <legend className="text-sm font-bold uppercase tracking-wide text-teal-dark">
                Frequency
              </legend>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <label className="flex items-center justify-center gap-2 rounded border border-teal/40 px-4 py-3">
                  <input type="radio" name="frequency" defaultChecked /> One time
                </label>
                <label className="flex items-center justify-center gap-2 rounded border border-teal/40 px-4 py-3">
                  <input type="radio" name="frequency" /> Monthly
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-bold uppercase tracking-wide text-teal-dark">
                Amount
              </legend>
              <div className="mt-2 grid grid-cols-3 gap-3">
                {amounts.map((a) => (
                  <label
                    key={a}
                    className="flex items-center justify-center rounded border border-teal/40 px-4 py-3 font-semibold"
                  >
                    <input
                      type="radio"
                      name="amount"
                      className="sr-only"
                      defaultChecked={a === "$20"}
                    />
                    {a}
                  </label>
                ))}
                <label className="col-span-3 flex items-center justify-center rounded border border-teal/40 px-4 py-3 font-semibold">
                  <input type="radio" name="amount" className="sr-only" /> Other
                </label>
              </div>
            </fieldset>

            <button
              type="submit"
              className="w-full rounded bg-maroon px-5 py-4 font-display text-lg font-bold uppercase tracking-wide text-white hover:bg-maroon-dark"
            >
              Donate $20
            </button>
            <p className="text-xs text-teal-dark/70">
              Demo only — checkout is not wired up.
            </p>
          </form>
        </section>

        <section>
          <h2 className="flex items-center gap-3 font-display text-2xl font-bold uppercase tracking-tight text-teal-dark">
            <span
              aria-hidden="true"
              className="grid h-12 w-12 place-items-center rounded-full bg-maroon text-white"
            >
              ✉
            </span>
            Mail Your Donation
          </h2>
          <p className="mt-4 text-teal-dark/90">
            To pay by <span className="font-semibold">check</span>, send any
            amount to:
          </p>
          <address className="mt-3 not-italic text-lg font-bold text-teal">
            RP Hope
            <br />
            P.O. Box 1163
            <br />
            Pleasanton, CA 94566
          </address>
          <p className="mt-5 text-teal-dark/90">
            Make checks payable to “RP Hope.”
          </p>
          <p className="mt-2 text-teal-dark/90">
            If you have questions, email{" "}
            <a className="text-link underline" href="mailto:information@rphope.org">
              information@rphope.org
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
