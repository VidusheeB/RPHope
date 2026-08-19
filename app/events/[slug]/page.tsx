import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import RegistrationForm from "@/components/site/events/RegistrationForm";
import { getEventBySlug } from "@/lib/wix/events";
import { formatEventDate, formatEventLocation } from "@/lib/wix/format";
import type { SiteEvent } from "@/lib/wix/types";

// Always current — see the note in app/events/page.tsx.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const event = await getEventBySlug(params.slug);
  if (!event) return { title: "Event — RP Hope" };
  return {
    title: `${event.title} — RP Hope`,
    description: event.shortDescription || event.descriptionParagraphs[0]?.slice(0, 160),
  };
}

export default async function EventDetailPage({ params }: { params: { slug: string } }) {
  const event = await getEventBySlug(params.slug);
  if (!event) notFound();

  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-4xl px-5 py-12">
        <Link
          href="/events"
          className="inline-flex items-center gap-2 text-sm font-semibold text-forest underline focus:outline-none focus:ring-2 focus:ring-gold"
        >
          <span aria-hidden="true">←</span> All events
        </Link>

        <h1 className="mt-6 font-display text-4xl font-medium tracking-tight text-ink">
          {event.title}
        </h1>

        <dl className="mt-5 space-y-2">
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-semibold text-ink">When:</dt>
            <dd className="text-forest font-semibold">{formatEventDate(event)}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-semibold text-ink">Where:</dt>
            <dd className="text-ink/80">{formatEventLocation(event)}</dd>
          </div>
        </dl>

        {event.imageUrl && (
          <Image
            src={event.imageUrl}
            alt={event.imageAlt || ""}
            width={1100}
            height={620}
            priority
            className="mt-8 w-full rounded-lg object-cover"
          />
        )}

        {event.shortDescription && (
          <p className="mt-8 text-lg leading-relaxed text-ink/85">{event.shortDescription}</p>
        )}

        {event.descriptionParagraphs.length > 0 && (
          <div className="mt-6 space-y-4">
            {event.descriptionParagraphs.map((paragraph, i) => (
              <p key={i} className="leading-relaxed text-ink/80">
                {paragraph}
              </p>
            ))}
          </div>
        )}

        <div className="mt-12">
          <Registration event={event} />
        </div>

        <p className="mt-10 text-sm text-ink/70">
          Questions about this event?{" "}
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

function Registration({ event }: { event: SiteEvent }) {
  switch (event.registrationState) {
    case "open":
    case "waitlist":
      return <RegistrationForm event={event} />;

    case "external":
      return (
        <Notice title="Registration for this event happens elsewhere">
          {event.externalUrl ? (
            <a
              href={event.externalUrl}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-md bg-forest px-6 py-3.5 text-base font-bold text-white transition hover:bg-forest-dark focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2"
              rel="noopener noreferrer"
              target="_blank"
            >
              Go to registration
              <span className="sr-only"> (opens in a new tab)</span>
              <span aria-hidden="true">→</span>
            </a>
          ) : (
            <p>Please email us and we&rsquo;ll point you to the right place.</p>
          )}
        </Notice>
      );

    case "tickets":
      return (
        <Notice title="This event uses tickets">
          <p>
            Ticket purchasing isn&rsquo;t available on this page yet. Please email us and we&rsquo;ll
            get you a ticket link.
          </p>
        </Notice>
      );

    case "scheduled":
      return (
        <Notice title="Registration opens soon">
          <p>Registration for this event hasn&rsquo;t opened yet. Please check back shortly.</p>
        </Notice>
      );

    case "closed":
      return (
        <Notice title="Registration is closed">
          <p>
            Registration for this event has closed. Email us anyway — there may still be room, or
            another way to take part.
          </p>
        </Notice>
      );

    case "ended":
      return (
        <Notice title="This event has ended">
          <p>Thanks to everyone who took part. Watch this space for what&rsquo;s next.</p>
        </Notice>
      );

    default:
      return (
        <Notice title="No registration needed">
          <p>Just come along — we&rsquo;d love to see you there.</p>
        </Notice>
      );
  }
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-6">
      <h2 className="font-display text-2xl font-medium tracking-tight text-ink">{title}</h2>
      <div className="mt-2 text-ink/80">{children}</div>
    </section>
  );
}
