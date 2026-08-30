import type { Metadata } from "next";
import Image from "next/image";
import EventCard from "@/components/site/events/EventCard";
import { listUpcomingEvents } from "@/lib/wix/events";

export const metadata: Metadata = {
  title: "Events — RP Hope",
  description:
    "RP Hope hosts global events to raise awareness and research dollars — the Spring Fundraiser and Green Cane Day.",
};

// Events are managed in Wix, so the page reads Wix on every request. This is
// deliberately NOT ISR: `revalidate` serves the cached page first and refreshes
// in the background, which means the visitor who arrives right after Carin
// edits an event sees the stale version. Events are low-traffic and the payoff
// is that what a visitor sees always matches the Wix dashboard.
export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const { events, unavailable } = await listUpcomingEvents();

  return (
    <div className="bg-cream">
      {/* Awareness hero */}
      <div className="relative isolate overflow-hidden">
        {/* Cropped to the collage's top row: the source is nearly square, and
            in this wide, short band object-cover would slice straight through
            the seam between the two rows and cut faces in half. */}
        <Image
          src="/events/spring-fundraiser-collage.jpg"
          alt="Spring Fundraiser participants around the world — families with their dogs, a runner by the sea, and a couple on a Dutch street, all wearing RP Hope race bibs."
          width={2200}
          height={976}
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
        {events.length > 0 ? (
          <div className="space-y-8">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-ink/10 bg-white p-8 text-center">
            <h2 className="font-display text-2xl font-medium tracking-tight text-ink">
              {unavailable ? "Our events list is taking a moment" : "No upcoming events right now"}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-ink/75">
              {unavailable
                ? "We couldn't load our events just now. Please refresh in a little while, or email us and we'll tell you what's coming up."
                : "We don't have an event on the calendar at the moment. New events are announced here — and we'd love to hear from you in the meantime."}
            </p>
          </div>
        )}

        <p className="mt-10 text-sm text-ink/70">
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
