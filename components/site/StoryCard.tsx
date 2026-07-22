import Link from "next/link";

// Shared story-card rendering, used by:
//  - the /stories grid (both curated external links and RP-Hope-hosted stories)
//  - a story's own /stories/[id] preview context
//  - the "how this works" example on /share-your-story (a real, already-
//    published story rendered non-interactively, so the example is honest
//    rather than a fabricated mockup)
export type StoryCardProps = {
  name: string;
  excerpt: string;
  tag?: string;
  /** Internal route (e.g. "/stories/abc123") — renders as a Next Link. */
  href?: string;
  /** External URL — renders as a new-tab <a> with a source line. */
  externalHref?: string;
  source?: string;
};

export default function StoryCard({ name, excerpt, tag, href, externalHref, source }: StoryCardProps) {
  const cardClasses =
    "group flex flex-col rounded-lg border border-ink/10 bg-white p-6 transition hover:border-forest/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2";

  const inner = (
    <>
      {tag && (
        <span className="self-start rounded-full bg-lilac px-3 py-1 text-xs font-bold text-[#5b51a3]">
          {tag}
        </span>
      )}
      <h3 className="mt-4 font-display text-xl font-bold text-ink">{name}</h3>
      <p className="mt-2 flex-1 text-ink/70">{excerpt}</p>
      {source && (
        <span className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink/40">
          {source}
        </span>
      )}
      {(href || externalHref) && (
        <span className="mt-2 text-sm font-bold text-forest">
          Read story <span aria-hidden="true">→</span>
          {externalHref && (
            <span className="sr-only"> (opens {source ?? "an external site"} in a new tab)</span>
          )}
        </span>
      )}
    </>
  );

  if (externalHref) {
    return (
      <a href={externalHref} target="_blank" rel="noopener noreferrer" className={cardClasses}>
        {inner}
      </a>
    );
  }
  if (href) {
    return (
      <Link href={href} className={cardClasses}>
        {inner}
      </Link>
    );
  }
  return <div className={cardClasses}>{inner}</div>;
}

/** Truncates story text to a card-sized excerpt on a word boundary. */
export function excerptOf(text: string, maxChars = 220): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxChars)}…`;
}
