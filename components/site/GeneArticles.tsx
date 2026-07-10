"use client";

import { useState } from "react";

export type Article = {
  title: string;
  url: string;
  date?: string;
  // Plain-English "why it matters" line (AI-drafted, human-reviewed) for items
  // pulled from PubMed / ClinicalTrials.gov. Absent on legacy curated articles.
  whyItMatters?: string;
  // Optional thumbnail (a journal cover or the paper's figure). When absent, a
  // neutral document icon is shown instead. See lib/geneArticleImages.ts.
  image?: { src: string; alt: string };
};

export default function GeneArticles({ articles }: { articles: Article[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? articles : articles.slice(0, 3);

  if (articles.length === 0) {
    return (
      <p className="rounded-lg border border-ink/12 bg-white p-6 text-ink/60">
        Curated research for this gene is being added. Check back soon.
      </p>
    );
  }

  return (
    <div>
      <ul className="grid gap-5 sm:grid-cols-3">
        {shown.map((a, i) => (
          <li key={a.url + i}>
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-full flex-col rounded-lg border border-ink/12 bg-white p-4 transition hover:border-forest/40"
            >
              {/* Real article thumbnail (journal cover / figure) when we have
                  a confident match; otherwise a neutral document icon. */}
              {a.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.image.src}
                  alt={a.image.alt}
                  loading="lazy"
                  className="aspect-[4/3] w-full rounded-md bg-cream-card object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="grid aspect-[4/3] w-full place-items-center rounded-md bg-cream-card text-forest/40"
                >
                  <svg
                    className="h-8 w-8"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
                    <path d="M14 3v5h5M9 13h6M9 17h6" />
                  </svg>
                </span>
              )}
              {a.date && (
                <span className="mt-3 text-xs text-ink/50">{a.date}</span>
              )}
              <span className="mt-1 font-semibold leading-snug text-ink">
                {a.title}
              </span>
              {a.whyItMatters && (
                <span className="mt-2 text-sm leading-snug text-ink/70">
                  <span className="font-semibold text-forest">Why it matters:</span>{" "}
                  {a.whyItMatters}
                </span>
              )}
              <span className="mt-auto pt-3 text-sm font-bold uppercase tracking-[0.06em] text-forest">
                Read →
              </span>
            </a>
          </li>
        ))}
      </ul>

      {articles.length > 3 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="rounded-md border border-forest/40 px-6 py-3 font-bold text-forest hover:bg-forest/5"
          >
            {expanded
              ? "Show fewer"
              : `See more (${articles.length - 3} more)`}
          </button>
        </div>
      )}
    </div>
  );
}
