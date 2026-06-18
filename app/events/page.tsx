import type { Metadata } from "next";
import FillerBox from "@/components/FillerBox";

export const metadata: Metadata = {
  title: "Events — RP Hope",
  description: "Upcoming RP Hope events.",
};

export default function EventsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="border-y-4 border-double border-teal py-2 text-center font-display text-5xl font-bold uppercase tracking-tight text-teal-dark">
        Our Events
      </h1>

      <div className="mt-10 grid items-center gap-6 rounded-lg border border-teal/15 bg-white p-6 shadow-sm sm:grid-cols-[1fr_1.2fr]">
        <FillerBox label="Green cane laces" className="aspect-[4/3] w-full" />
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold text-teal-dark">
            Green Cane Day 2026
          </h2>
          <p className="mt-2 text-teal-dark/80">
            Sat, Sep 26 &nbsp;|&nbsp; Virtual Event
          </p>
          <p className="mt-4 text-teal-dark/90">
            Join teams in Argentina and Uruguay.
          </p>
          <button
            type="button"
            className="mt-5 font-display text-lg font-bold uppercase tracking-wide text-maroon hover:underline"
          >
            Register
          </button>
        </div>
      </div>
    </div>
  );
}
