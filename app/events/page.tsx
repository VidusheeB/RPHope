import type { Metadata } from "next";
import Image from "next/image";
import CTAButton from "@/components/site/CTAButton";

export const metadata: Metadata = {
  title: "Events — RP Hope",
  description:
    "RP Hope hosts global events to raise awareness and research dollars — the Spring Fundraiser and Green Cane Day.",
};

// Event content is faithful to the original Wix events pages. Images are the
// real RP Hope event assets, placed where Wix used them (Spring Fundraiser
// flyer, the green cane, and the low-vision awareness campaign still).
const events = [
  {
    title: "Spring Fundraiser — “1-Day in April”",
    when: "Sunday, April 26, 2026 · 7 AM–7 PM (your time zone)",
    where: "Global · Virtual",
    body: "Our 5th annual Spring Fundraiser. Walk, run, cycle, or hike — any distance, any time that day. Register, print your race bib, and take a selfie on race day. Teams join from Singapore, Australia, Nepal, the U.S., New Zealand, the Netherlands, Germany, Panama, Colombia, Brazil, and Canada.",
    img: {
      src: "/events/spring-fundraiser-2026.jpg",
      w: 1000,
      h: 1250,
      alt: "RP Hope “1-Day in April” Spring Fundraiser flyer showing families holding race bibs and event details for Sunday, April 26.",
    },
    tag: "Fundraiser",
  },
  {
    title: "Green Cane Day",
    when: "Saturday, September 26 · Virtual",
    where: "Teams in Argentina and Uruguay",
    body: "A day to raise awareness about the green cane and the low-vision community. The green cane signals low vision (distinct from the white cane used for blindness), helping build recognition and understanding.",
    img: {
      src: "/events/green-cane.jpg",
      w: 700,
      h: 700,
      alt: "A folding green mobility cane with a black grip, used to signal low vision.",
    },
    tag: "Awareness",
  },
];

export default function EventsPage() {
  return (
    <div className="bg-cream">
      {/* Awareness hero */}
      <div className="relative isolate overflow-hidden">
        <Image
          src="/events/low-vision-campaign.jpg"
          alt="A group of people of different ages standing together in a park, several wearing low-vision awareness badges."
          width={1100}
          height={613}
          priority
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-forest/80" aria-hidden="true" />
        <div className="relative mx-auto max-w-4xl px-5 py-20 text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-gold-soft">
            Get Involved
          </p>
          <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-white sm:text-5xl">
            Our events
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-white/85">
            RP Hope hosts global events to raise awareness about retinitis
            pigmentosa and fund the research working toward treatments.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-5 py-16">
        <div className="space-y-8">
          {events.map((e) => (
            <article
              key={e.title}
              className="grid items-center gap-6 rounded-lg border border-ink/10 bg-white p-6 sm:grid-cols-[minmax(0,1fr)_1.3fr]"
            >
              <Image
                src={e.img.src}
                alt={e.img.alt}
                width={e.img.w}
                height={e.img.h}
                className="w-full rounded-md object-cover"
              />
              <div>
                <span className="inline-block rounded-full bg-mint px-3 py-1 text-xs font-bold text-forest">
                  {e.tag}
                </span>
                <h2 className="mt-3 font-display text-2xl font-medium tracking-tight text-ink">
                  {e.title}
                </h2>
                <p className="mt-2 font-semibold text-forest">{e.when}</p>
                <p className="text-sm text-ink/60">{e.where}</p>
                <p className="mt-4 text-ink/75">{e.body}</p>
                <div className="mt-5">
                  <CTAButton href="/donate" variant="primary" arrow>
                    Register &amp; support
                  </CTAButton>
                </div>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-10 text-sm text-ink/55">
          Want to bring an RP Hope team to your country or ask about an event?{" "}
          <a
            href="mailto:information@rphope.org"
            className="font-semibold text-forest underline"
          >
            Email us
          </a>
          .
        </p>
      </div>
    </div>
  );
}
