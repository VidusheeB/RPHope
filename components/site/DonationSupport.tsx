import CTAButton from "./CTAButton";

export default function DonationSupport() {
  return (
    <section className="bg-cream py-20" aria-labelledby="donation-support">
      <div className="mx-auto max-w-5xl px-5">
        <div className="rounded-lg border border-ink/12 bg-cream-card px-6 py-16 text-center">
          <span
            aria-hidden="true"
            className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-forest/25 text-forest"
          >
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.8 8.6a5 5 0 0 0-8.8-3.2A5 5 0 0 0 3.2 8.6c0 4.2 5.6 8 8.8 10.4 3.2-2.4 8.8-6.2 8.8-10.4Z" />
            </svg>
          </span>
          <h2
            id="donation-support"
            className="mx-auto mt-6 max-w-2xl font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl"
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
              Support RP Hope
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
