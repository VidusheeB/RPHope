import CTAButton from "./CTAButton";

export default function EventsCommunity() {
  return (
    <section className="bg-cream-header py-20" aria-labelledby="events-community">
      <div className="mx-auto max-w-7xl px-5">
        <h2
          id="events-community"
          className="font-display text-4xl font-bold text-ink sm:text-5xl"
        >
          Events &amp; community
        </h2>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {/* Upcoming event */}
          <article className="rounded-2xl border border-ink/10 bg-white p-8 shadow-sm">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-forest">
              <span aria-hidden="true">📅</span> Upcoming Event
            </p>
            <div className="mt-6 border-l-4 border-forest pl-4">
              <p className="text-sm text-ink/60">
                July 19, 2025 · 2:00 PM ET · Online
              </p>
              <h3 className="mt-1 font-display text-2xl font-bold text-ink">
                Understanding Your RP Genetic Report
              </h3>
              <p className="mt-3 leading-relaxed text-ink/75">
                A live Q&amp;A with a genetic counselor and an RP researcher —
                bring your report, bring your questions.
              </p>
            </div>
            <CTAButton href="/events" variant="primary" arrow className="mt-6">
              Register free
            </CTAButton>
          </article>

          {/* Community */}
          <article className="rounded-2xl bg-forest p-8 text-white shadow-sm">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/70">
              <span aria-hidden="true">👥</span> Community
            </p>
            <h3 className="mt-6 font-display text-2xl font-bold">
              RP Hope Community Forum
            </h3>
            <p className="mt-3 leading-relaxed text-white/80">
              Connect with others who share your gene, swap advice on navigating
              medical appointments, and find mentors who are years ahead on this
              path.
            </p>
            <CTAButton href="/explore" variant="white" arrow className="mt-6">
              Join the community
            </CTAButton>
          </article>
        </div>
      </div>
    </section>
  );
}
