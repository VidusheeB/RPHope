import CTAButton from "./CTAButton";

export default function DonationSupport() {
  return (
    <section className="bg-cream py-20" aria-labelledby="donation-support">
      <div className="mx-auto max-w-5xl px-5">
        <div className="rounded-3xl border border-ink/10 bg-cream-card px-6 py-16 text-center shadow-sm">
          <span
            aria-hidden="true"
            className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-forest/10 text-2xl text-forest"
          >
            ♡
          </span>
          <h2
            id="donation-support"
            className="mx-auto mt-6 max-w-2xl font-display text-4xl font-bold text-ink sm:text-5xl"
          >
            Help families access clearer RP research and community support.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-ink/70">
            RP Hope is a volunteer-led nonprofit. Every dollar funds clear, jargon-free
            research summaries, genetic counseling resources, and family support
            programs.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <CTAButton href="/donate" variant="primary">
              <span aria-hidden="true">♡</span> Support RP Hope
            </CTAButton>
            <CTAButton href="/explore" variant="secondary">
              Learn how we work
            </CTAButton>
          </div>
        </div>
      </div>
    </section>
  );
}
