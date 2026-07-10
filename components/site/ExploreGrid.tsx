import Link from "next/link";

type IconKey =
  | "dna"
  | "trial"
  | "microscope"
  | "calendar"
  | "chat"
  | "heart"
  | "mail"
  | "book";

export type ExploreItem = {
  title: string;
  description: string;
  href: string;
  icon: IconKey;
};

export const exploreItems: ExploreItem[] = [
  {
    title: "Search Genetic Insights",
    description: "Look up any RP-linked gene for a clear, jargon-free summary.",
    href: "/genetic-insights",
    icon: "dna",
  },
  {
    title: "Browse Clinical Trials",
    description: "See trials recruiting now, by gene, location, and age.",
    href: "/clinical-trials",
    icon: "trial",
  },
  {
    title: "Learn About Genetic Testing",
    description: "What testing involves, what to ask, and why it matters.",
    href: "/newly-diagnosed",
    icon: "microscope",
  },
  {
    title: "View Events",
    description: "Live Q&As, fundraisers, and community gatherings.",
    href: "/events",
    icon: "calendar",
  },
  {
    title: "Read Stories",
    description: "Real accounts from people and families navigating RP.",
    href: "/stories",
    icon: "chat",
  },
  {
    title: "Donate or Fundraise",
    description: "Fund clear, jargon-free research and family support.",
    href: "/donate",
    icon: "heart",
  },
  {
    title: "Contact RP Hope",
    description: "Questions? Reach the team directly.",
    href: "mailto:information@rphope.org",
    icon: "mail",
  },
  {
    title: "Research Library",
    description: "The full archive of curated articles and papers.",
    href: "/genetic-insights",
    icon: "book",
  },
];

// Thin line-icon set (consistent 1.5px stroke) — replaces the old emoji.
const paths: Record<IconKey, React.ReactNode> = {
  dna: (
    <>
      <path d="M7 3c0 4 10 6 10 9s-10 5-10 9" />
      <path d="M17 3c0 4-10 6-10 9s10 5 10 9" />
      <path d="M8.5 7h7M8.5 17h7M7.5 10h9M7.5 14h9" />
    </>
  ),
  trial: (
    <>
      <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3" />
      <path d="M7.5 14h9" />
    </>
  ),
  microscope: (
    <>
      <path d="M6 18h10M8 18a5 5 0 0 0 8-4M9 4l4 4-2.5 2.5L6.5 6.5Z" />
      <path d="M11 10 6 15" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </>
  ),
  chat: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12Z" />,
  heart: (
    <path d="M20.8 8.6a5 5 0 0 0-8.8-3.2A5 5 0 0 0 3.2 8.6c0 4.2 5.6 8 8.8 10.4 3.2-2.4 8.8-6.2 8.8-10.4Z" />
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2Z" />
      <path d="M12 6.5v13" />
    </>
  ),
};

export default function ExploreGrid() {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {exploreItems.map((item) => {
        const external = item.href.startsWith("mailto:");
        const inner = (
          <>
            <span
              aria-hidden="true"
              className="grid h-11 w-11 place-items-center rounded-md border border-ink/15 text-forest"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {paths[item.icon]}
              </svg>
            </span>
            <h2 className="mt-4 font-display text-xl font-medium text-ink">
              {item.title}
            </h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-ink/70">
              {item.description}
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.06em] text-forest">
              Go <span aria-hidden="true">→</span>
            </span>
          </>
        );
        return (
          <li key={item.title} className="h-full">
            {external ? (
              <a
                href={item.href}
                className="flex h-full flex-col rounded-lg border border-ink/12 bg-white p-6 transition hover:border-forest/40"
              >
                {inner}
              </a>
            ) : (
              <Link
                href={item.href}
                className="flex h-full flex-col rounded-lg border border-ink/12 bg-white p-6 transition hover:border-forest/40"
              >
                {inner}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
