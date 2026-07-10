import Link from "next/link";
import GeneCard, { type GeneCardData } from "./GeneCard";
import Eyebrow from "./Eyebrow";

const featured: GeneCardData[] = [
  {
    gene: "USH2A",
    slug: "ush2a",
    summary:
      "The most common cause of Usher syndrome type 2, affecting both hearing and vision with progressive retinal degeneration typically starting in adolescence.",
    tag: "Active Trials",
    tagTone: "mint",
  },
  {
    gene: "PDE6B",
    slug: "pde6b",
    summary:
      "Causes autosomal recessive retinitis pigmentosa with rod photoreceptor loss beginning in early childhood, often leading to significant vision loss by mid-life.",
    tag: "Emerging Research",
    tagTone: "butter",
  },
  {
    gene: "RPGR",
    slug: "rpgr",
    summary:
      "An X-linked gene predominantly affecting males with severe, early-onset rod-cone dystrophy; gene therapy trials are among the most advanced in the RP field.",
    tag: "Gene Therapy Trials",
    tagTone: "lilac",
  },
];

export default function GeneInsightsPreview() {
  return (
    <section className="bg-cream-header py-20" aria-labelledby="gi-preview">
      <div className="mx-auto max-w-7xl px-5">
        <Eyebrow>Genetic Insights</Eyebrow>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <h2
              id="gi-preview"
              className="font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl"
            >
              Explore genes linked to RP
            </h2>
            <p className="mt-4 text-lg text-ink/70">
              Clear, jargon-free summaries of what each gene means, what research
              exists, and where trials stand today.
            </p>
          </div>
          <Link
            href="/genetic-insights"
            className="inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.06em] text-forest hover:text-forest-dark"
          >
            Browse all genes <span aria-hidden="true">→</span>
          </Link>
        </div>

        {/* Search bar (links to full library) */}
        <form action="/genetic-insights" className="mt-8" role="search">
          <label htmlFor="gene-quick-search" className="sr-only">
            Search genes
          </label>
          <div className="flex items-center gap-3 rounded-lg border border-ink/15 bg-white px-5 py-4">
            <svg
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-ink/40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              id="gene-quick-search"
              name="q"
              type="search"
              placeholder="Search genes like USH2A, PDE6B, RPGR…"
              className="w-full bg-transparent text-lg outline-none placeholder:text-ink/40"
            />
          </div>
        </form>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {featured.map((g) => (
            <GeneCard key={g.slug} data={g} />
          ))}
        </div>
      </div>
    </section>
  );
}
