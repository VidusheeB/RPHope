import Link from "next/link";
import Eyebrow from "./Eyebrow";

export default function ChoosePath() {
  return (
    <section className="bg-cream py-20" aria-labelledby="choose-path">
      <div className="mx-auto max-w-6xl px-5">
        <Eyebrow>Where to begin</Eyebrow>
        <h2
          id="choose-path"
          className="mt-5 font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl"
        >
          Choose your path
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-ink/70">
          RP Hope supports families at every stage — whether you have genetic
          answers or are just beginning to find them.
        </p>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {/* My RP Pathway */}
          <article className="flex flex-col rounded-lg bg-forest p-8 text-white">
            <h3 className="font-display text-2xl font-medium">My RP Pathway</h3>
            <p className="mt-3 flex-1 leading-relaxed text-white/80">
              Answer a few questions and get a personalized guide to RP Hope&rsquo;s
              research, genetic testing resources, trials, stories, events, and
              updates.
            </p>
            <Link
              href="/my-pathway"
              className="mt-6 inline-flex items-center gap-1.5 self-start text-sm font-bold uppercase tracking-[0.06em] text-gold-soft hover:text-white"
            >
              Personalize <span aria-hidden="true">→</span>
            </Link>
          </article>

          {/* Explore RP Hope */}
          <article className="flex flex-col rounded-lg border border-ink/12 bg-cream-header p-8">
            <h3 className="font-display text-2xl font-medium text-ink">
              Explore RP Hope
            </h3>
            <p className="mt-3 flex-1 leading-relaxed text-ink/75">
              Already know what you need? Jump directly to genes, trials, events,
              stories, donations, or contact.
            </p>
            <Link
              href="/explore"
              className="mt-6 inline-flex items-center gap-1.5 self-start text-sm font-bold uppercase tracking-[0.06em] text-forest hover:text-forest-dark"
            >
              Browse <span aria-hidden="true">→</span>
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}
