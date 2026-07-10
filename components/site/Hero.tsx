import CTAButton from "./CTAButton";
import Eyebrow from "./Eyebrow";

export default function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-forest-deep">
      {/* Background image + dark teal overlay */}
      <div className="absolute inset-0 -z-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/home/eye-a.jpg"
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-forest-deep via-forest-deep/95 to-forest/70" />
      </div>

      <div className="mx-auto max-w-7xl px-5 py-24 lg:py-32">
        <div className="max-w-2xl">
          <Eyebrow tone="dark">Genetics · Research · Community</Eyebrow>

          <h1 className="mt-6 font-display text-5xl font-medium leading-[1.03] tracking-tight text-white sm:text-6xl">
            Understand RP research.{" "}
            <span className="italic text-gold-soft">
              Find your path forward.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/85">
            RP Hope helps patients, families, caregivers, researchers, and
            supporters navigate retinitis pigmentosa research, genetic insights,
            clinical trials, events, and community resources.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <CTAButton href="/my-pathway" variant="white" arrow>
              Personalize my experience
            </CTAButton>
            <CTAButton href="/explore" variant="outline-light" arrow>
              I know what I&rsquo;m looking for
            </CTAButton>
          </div>
        </div>
      </div>
    </section>
  );
}
