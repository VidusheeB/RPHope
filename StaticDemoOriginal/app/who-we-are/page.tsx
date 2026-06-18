import type { Metadata } from "next";
import FillerBox from "@/components/FillerBox";

export const metadata: Metadata = {
  title: "Who We Are — RP Hope",
  description:
    "Learn about RP Hope, a nonprofit funding research toward treatments for retinitis pigmentosa.",
};

const board = ["Lyndon Elam", "Tim Geistlinger", "Kevin Unger", "Eric Elam"];

export default function WhoWeArePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="border-y-4 border-double border-teal py-2 font-display text-4xl font-bold uppercase tracking-tight text-teal-dark">
        Who We Are
      </h1>

      {/* Mission/Vision/Fundraising + collage */}
      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <div className="space-y-6">
          <section>
            <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-teal-dark">
              Mission
            </h2>
            <p className="mt-2 leading-relaxed text-teal-dark/90">
              We serve to educate and fund research in pursuit of effective and
              affordable treatments for retinitis pigmentosa (RP). RP Hope is a
              resource for those affected by RP and looking for information about
              this rare genetic retinal disease.
            </p>
          </section>
          <section>
            <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-teal-dark">
              Vision
            </h2>
            <p className="mt-2 leading-relaxed text-teal-dark/90">
              A world where treatments for RP are operative, effective, and
              accessible to all patients.
            </p>
          </section>
          <section>
            <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-teal-dark">
              Fundraising
            </h2>
            <p className="mt-2 leading-relaxed text-teal-dark/90">
              Funds raised will go toward research seeking treatments for
              non-syndromic retinitis pigmentosa.
            </p>
          </section>
        </div>
        <FillerBox
          label="Photo collage of RP Hope community"
          className="min-h-[18rem] w-full"
        />
      </div>

      {/* Board of Directors */}
      <section className="mt-12">
        <h2 className="border-y-4 border-double border-teal py-2 font-display text-3xl font-bold uppercase tracking-tight text-teal-dark">
          Board of Directors
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {board.map((name) => (
            <li
              key={name}
              className="flex items-center gap-2 rounded-lg border border-teal/15 bg-cream px-4 py-3"
            >
              <span
                aria-hidden="true"
                className="grid h-6 w-6 place-items-center rounded bg-link text-xs font-bold text-white"
              >
                in
              </span>
              <span className="font-semibold text-teal">{name}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Team + Tax Filings */}
      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="font-display text-3xl font-bold uppercase tracking-tight text-teal-dark">
            Team
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <FillerBox label="Team photo" className="aspect-square w-full" />
            <FillerBox
              label="Team group photo"
              className="aspect-square w-full"
            />
          </div>
        </section>
        <section>
          <h2 className="font-display text-3xl font-bold uppercase tracking-tight text-teal-dark">
            Tax Filings
          </h2>
          <p className="mt-3 text-teal-dark/90">To view, click the link below.</p>
          <p className="mt-4 font-semibold text-teal">Annual Filings ⬇</p>
          <p className="mt-4 text-teal-dark/90">
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
