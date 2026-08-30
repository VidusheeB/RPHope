"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { geneImages } from "@/lib/geneImages";
import NavAssistant from "@/components/site/NavAssistant";

export type GridItem = { display: string; slug: string; label: string };

export default function GeneLibrary({ items }: { items: GridItem[] }) {
  const [category, setCategory] = useState("all");

  const categories = useMemo(
    () => Array.from(new Set(items.map((g) => g.label).filter(Boolean))).sort(),
    [items]
  );

  const results = useMemo(
    () => items.filter((g) => category === "all" || g.label === category),
    [items, category]
  );

  return (
    <div>
      {/* Assistant + the inheritance filter */}
      <section className="rounded-lg border border-forest/20 bg-forest/5 p-5 sm:p-6">
        <NavAssistant />

        <div className="mt-5 flex flex-col gap-2 border-t border-forest/15 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <label
            htmlFor="gene-category"
            className="text-sm font-semibold text-ink/80"
          >
            Or browse the full gene list by inheritance pattern:
          </label>
          <select
            id="gene-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-md border border-ink/20 bg-white px-4 py-2.5 text-base outline-none focus:border-forest sm:w-72"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </section>

      <p aria-live="polite" className="mt-6 text-sm font-medium text-ink/80">
        Showing {results.length} {results.length === 1 ? "gene" : "genes"}
        {category !== "all" ? ` · ${category}` : ""}
      </p>

      <ul className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {results.map((g) => (
          <li key={g.slug}>
            <Link
              href={`/genetic-insights/${g.slug}`}
              className="block rounded-lg border border-ink/12 bg-white p-3 text-center transition hover:border-forest/40"
            >
              {geneImages.has(g.slug) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/genes/${g.slug}.jpg`}
                  alt={`${g.display} — Face of RP`}
                  className="aspect-square w-full rounded-md object-cover"
                />
              ) : (
                // Placeholder for a gene with no Face of RP photo yet. A grey
                // eye ICON rather than the eye photograph in /public/home: a
                // real photo here would look like a genuine Face of RP, which
                // is exactly what this tile means is missing.
                <span
                  aria-hidden="true"
                  className="grid aspect-square w-full place-items-center rounded-md bg-cream-card text-ink/30"
                >
                  <svg
                    className="h-10 w-10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </span>
              )}
              <span className="mt-3 block font-sans text-lg font-bold tracking-tight text-ink">
                {g.display}
              </span>
              <span className="block text-sm font-semibold text-forest">
                {g.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
