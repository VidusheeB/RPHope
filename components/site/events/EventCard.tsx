import Image from "next/image";
import Link from "next/link";
import type { SiteEvent } from "@/lib/wix/types";
import { formatEventDate, formatEventLocation, registrationLabel } from "@/lib/wix/format";

// The state pill carries a text label as well as color, so it never depends on
// color alone to convey meaning.
const pillStyles: Record<SiteEvent["registrationState"], string> = {
  open: "bg-mint text-forest",
  waitlist: "bg-butter text-ink",
  scheduled: "bg-butter text-ink",
  closed: "bg-ink/10 text-ink",
  external: "bg-lilac text-ink",
  tickets: "bg-lilac text-ink",
  none: "bg-ink/10 text-ink",
  ended: "bg-ink/10 text-ink",
};

function ctaLabel(state: SiteEvent["registrationState"]): string {
  switch (state) {
    case "open":
      return "Register";
    case "waitlist":
      return "Join the waitlist";
    case "external":
    case "tickets":
      return "How to register";
    default:
      return "View event";
  }
}

export default function EventCard({ event }: { event: SiteEvent }) {
  const href = `/events/${event.slug}`;

  return (
    <article className="grid items-center gap-6 rounded-lg border border-ink/10 bg-white p-6 sm:grid-cols-[minmax(0,1fr)_1.3fr]">
      {event.imageUrl ? (
        <Image
          src={event.imageUrl}
          alt={event.imageAlt || ""}
          width={700}
          height={700}
          className="w-full rounded-md object-cover"
        />
      ) : (
        <div className="hidden sm:block" aria-hidden="true" />
      )}

      <div>
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${
            pillStyles[event.registrationState]
          }`}
        >
          {registrationLabel(event)}
        </span>

        <h2 className="mt-3 font-display text-2xl font-medium tracking-tight text-ink">
          <Link href={href} className="hover:underline focus:outline-none focus:ring-2 focus:ring-gold">
            {event.title}
          </Link>
        </h2>

        <p className="mt-2 font-semibold text-forest">{formatEventDate(event)}</p>
        <p className="text-sm text-ink/70">{formatEventLocation(event)}</p>

        {event.shortDescription && (
          <p className="mt-4 text-ink/75">{event.shortDescription}</p>
        )}

        <div className="mt-5">
          <Link
            href={href}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-forest px-6 py-3.5 text-base font-bold text-white transition hover:bg-forest-dark focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2"
          >
            {ctaLabel(event.registrationState)}
            <span className="sr-only"> for {event.title}</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
