import type { Metadata } from "next";
import CTAButton from "@/components/site/CTAButton";

export const metadata: Metadata = {
  title: "Stories — RP Hope",
  description:
    "Real accounts from people and families navigating retinitis pigmentosa.",
};

const stories = [
  {
    name: "Rosie",
    blurb:
      "Diagnosed in childhood, Rosie shares how genetic testing reframed her family's path forward.",
    tag: "Patient story",
  },
  {
    name: "The Lemay-Pelletier family",
    blurb:
      "Two siblings with PDE6B RP — a parent's account of testing, trials, and daily life.",
    tag: "Family story",
  },
  {
    name: "Steve",
    blurb:
      "Living with X-linked RP (RPGR) and following the gene-therapy research closely.",
    tag: "Patient story",
  },
];

export default function StoriesPage() {
  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-5xl px-5 py-16">
        <p className="text-sm font-bold uppercase tracking-widest text-forest">
          Stories
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold text-ink sm:text-5xl">
          Stories like yours
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink/75">
          RP looks different for everyone. These are real accounts from people and
          families navigating diagnosis, genetic testing, trials, and everyday
          life.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {stories.map((s) => (
            <article
              key={s.name}
              className="flex flex-col rounded-2xl border border-ink/10 bg-white p-6 shadow-sm"
            >
              <span className="self-start rounded-full bg-lilac px-3 py-1 text-xs font-bold text-[#5b51a3]">
                {s.tag}
              </span>
              <h2 className="mt-4 font-display text-xl font-bold text-ink">
                {s.name}
              </h2>
              <p className="mt-2 flex-1 text-ink/70">{s.blurb}</p>
              <span className="mt-4 text-sm font-bold text-forest">
                Read story →
              </span>
            </article>
          ))}
        </div>

        <div className="mt-10">
          <CTAButton href="/explore" variant="secondary" arrow>
            Share your story
          </CTAButton>
        </div>
      </div>
    </div>
  );
}
