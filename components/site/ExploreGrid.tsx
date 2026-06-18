import Link from "next/link";

export type ExploreItem = {
  title: string;
  description: string;
  href: string;
  icon: string;
};

export const exploreItems: ExploreItem[] = [
  {
    title: "Search Genetic Insights",
    description: "Look up any RP-linked gene for a plain-English summary.",
    href: "/genetic-insights",
    icon: "🧬",
  },
  {
    title: "Browse Clinical Trials",
    description: "See trials recruiting now, by gene, location, and age.",
    href: "/clinical-trials",
    icon: "🧪",
  },
  {
    title: "Learn About Genetic Testing",
    description: "What testing involves, what to ask, and why it matters.",
    href: "/newly-diagnosed",
    icon: "🔬",
  },
  {
    title: "View Events",
    description: "Live Q&As, fundraisers, and community gatherings.",
    href: "/events",
    icon: "📅",
  },
  {
    title: "Read Stories",
    description: "Real accounts from people and families navigating RP.",
    href: "/stories",
    icon: "💬",
  },
  {
    title: "Donate or Fundraise",
    description: "Fund plain-English research and family support.",
    href: "/donate",
    icon: "♡",
  },
  {
    title: "Contact RP Hope",
    description: "Questions? Reach the team directly.",
    href: "mailto:information@rphope.org",
    icon: "✉️",
  },
  {
    title: "Research Library",
    description: "The full archive of curated articles and papers.",
    href: "/genetic-insights",
    icon: "📚",
  },
];

export default function ExploreGrid() {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {exploreItems.map((item) => {
        const external = item.href.startsWith("mailto:");
        const inner = (
          <>
            <span aria-hidden="true" className="text-3xl">
              {item.icon}
            </span>
            <h2 className="mt-4 font-display text-xl font-bold text-ink">
              {item.title}
            </h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-ink/70">
              {item.description}
            </p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-forest">
              Go <span aria-hidden="true">→</span>
            </span>
          </>
        );
        return (
          <li key={item.title} className="h-full">
            {external ? (
              <a
                href={item.href}
                className="flex h-full flex-col rounded-2xl border border-ink/10 bg-white p-6 shadow-sm transition hover:border-forest/40 hover:shadow-md"
              >
                {inner}
              </a>
            ) : (
              <Link
                href={item.href}
                className="flex h-full flex-col rounded-2xl border border-ink/10 bg-white p-6 shadow-sm transition hover:border-forest/40 hover:shadow-md"
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
