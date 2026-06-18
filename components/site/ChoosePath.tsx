import CTAButton from "./CTAButton";

export default function ChoosePath() {
  return (
    <section className="bg-cream py-20" aria-labelledby="choose-path">
      <div className="mx-auto max-w-5xl px-5 text-center">
        <h2
          id="choose-path"
          className="font-display text-4xl font-bold text-ink sm:text-5xl"
        >
          Choose your path
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-ink/70">
          RP Hope supports families at every stage — whether you have genetic
          answers or are just beginning to find them.
        </p>

        <div className="mt-12 grid gap-6 text-left md:grid-cols-2">
          {/* My RP Pathway */}
          <article className="flex flex-col rounded-2xl bg-forest p-8 text-white shadow-sm">
            <span
              aria-hidden="true"
              className="grid h-12 w-12 place-items-center rounded-xl bg-white/15 text-xl"
            >
              🧬
            </span>
            <h3 className="mt-6 font-display text-2xl font-bold">
              My RP Pathway
            </h3>
            <p className="mt-3 flex-1 leading-relaxed text-white/80">
              Answer a few questions and get a personalized guide to RP Hope&rsquo;s
              research, genetic testing resources, trials, stories, events, and
              updates.
            </p>
            <CTAButton
              href="/my-pathway"
              variant="white"
              arrow
              className="mt-6 self-start"
            >
              Personalize my experience
            </CTAButton>
          </article>

          {/* Explore RP Hope */}
          <article className="flex flex-col rounded-2xl border border-ink/10 bg-cream-card p-8 shadow-sm">
            <span
              aria-hidden="true"
              className="grid h-12 w-12 place-items-center rounded-xl bg-gold/20 text-xl"
            >
              📖
            </span>
            <h3 className="mt-6 font-display text-2xl font-bold text-ink">
              Explore RP Hope
            </h3>
            <p className="mt-3 flex-1 leading-relaxed text-ink/75">
              Already know what you need? Jump directly to genes, trials, events,
              stories, donations, or contact.
            </p>
            <CTAButton
              href="/explore"
              variant="dark"
              arrow
              className="mt-6 self-start"
            >
              I know what I&rsquo;m looking for
            </CTAButton>
          </article>
        </div>
      </div>
    </section>
  );
}
