"use client";

import { useMemo, useState } from "react";
import index from "@/lib/searchIndex.json";

type Item = { type: "article" | "event"; title: string; snippet: string; url: string };
const data = index as Item[];

const articleCount = data.filter((d) => d.type === "article").length;
const eventCount = data.filter((d) => d.type === "event").length;

export default function SearchClient() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"article" | "event">("article");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.filter((d) => {
      if (d.type !== tab) return false;
      if (q === "") return true;
      return (
        d.title.toLowerCase().includes(q) || d.snippet.toLowerCase().includes(q)
      );
    });
  }, [query, tab]);

  return (
    <div>
      <form className="mt-8" role="search" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="site-search" className="sr-only">
          Search word
        </label>
        <div className="flex items-center gap-2 rounded border border-teal/30 bg-white px-4 py-3">
          <span aria-hidden="true" className="text-teal-dark/50">
            🔍
          </span>
          <input
            id="site-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter search word . . ."
            className="w-full text-lg outline-none"
          />
        </div>
      </form>

      {/* Tabs */}
      <div className="mt-6 flex gap-6 border-b border-teal/15 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setTab("article")}
          aria-pressed={tab === "article"}
          className={`pb-2 ${
            tab === "article"
              ? "border-b-2 border-teal text-teal"
              : "text-teal-dark/60"
          }`}
        >
          Articles &amp; Papers ({articleCount})
        </button>
        <button
          type="button"
          onClick={() => setTab("event")}
          aria-pressed={tab === "event"}
          className={`pb-2 ${
            tab === "event"
              ? "border-b-2 border-teal text-teal"
              : "text-teal-dark/60"
          }`}
        >
          Events ({eventCount})
        </button>
      </div>

      <p aria-live="polite" className="mt-6 text-sm text-teal-dark/80">
        {results.length} results found
      </p>

      <ul className="mt-4 divide-y divide-teal/10">
        {results.map((r, i) => (
          <li key={r.url + i} className="py-4">
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-link underline"
            >
              {r.title}
            </a>
            {r.snippet && (
              <p className="mt-1 text-sm leading-relaxed text-teal-dark/80">
                {r.snippet}
              </p>
            )}
          </li>
        ))}
        {results.length === 0 && (
          <li className="py-6 text-teal-dark/70">
            No results match &ldquo;{query}&rdquo;. Try a different word.
          </li>
        )}
      </ul>
    </div>
  );
}
