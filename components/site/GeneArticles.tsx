"use client";

import { useState } from "react";

export type Article = { title: string; url: string; date?: string };

export default function GeneArticles({ articles }: { articles: Article[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? articles : articles.slice(0, 3);

  if (articles.length === 0) {
    return (
      <p className="rounded-2xl border border-ink/10 bg-white p-6 text-ink/60">
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
              className="flex h-full flex-col rounded-2xl border border-ink/10 bg-white p-4 shadow-sm transition hover:border-forest/40 hover:shadow-md"
            >
              {/* Article image placeholder until images are curated */}
              <span
                aria-hidden="true"
                className="grid aspect-[4/3] w-full place-items-center rounded-lg bg-cream-card text-3xl text-forest/40"
              >
                📄
              </span>
              {a.date && (
                <span className="mt-3 text-xs text-ink/50">{a.date}</span>
              )}
              <span className="mt-1 font-semibold leading-snug text-ink">
                {a.title}
              </span>
              <span className="mt-3 text-sm font-bold text-forest">
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
            className="rounded-xl border border-forest/40 px-6 py-3 font-bold text-forest hover:bg-forest/5"
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
