import type { Metadata } from "next";
import ExploreGrid from "@/components/site/ExploreGrid";

export const metadata: Metadata = {
  title: "Explore RP Hope",
  description:
    "Jump directly to genetic insights, clinical trials, genetic testing, events, stories, donations, or contact.",
};

export default function ExplorePage() {
  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-7xl px-5 py-16">
        <p className="text-sm font-bold uppercase tracking-widest text-forest">
          Explore RP Hope
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold text-ink sm:text-5xl">
          Jump straight to what you need
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-ink/70">
          Already know what you&rsquo;re looking for? Pick a destination — or{" "}
          <a href="/my-pathway" className="font-semibold text-forest underline">
            build a personalized pathway
          </a>{" "}
          instead.
        </p>

        <div className="mt-10">
          <ExploreGrid />
        </div>
      </div>
    </div>
  );
}
