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
        <span className="inline-block border-b border-gold pb-2 text-xs font-bold uppercase tracking-[0.2em] text-forest">
          Explore RP Hope
        </span>
        <h1 className="mt-5 font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
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
