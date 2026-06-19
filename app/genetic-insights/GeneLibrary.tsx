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
      {/* Teal box: AI assistant + the inheritance filter */}
      <section className="rounded-2xl border border-forest/20 bg-forest/5 p-5 sm:p-6">
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
            className="rounded-xl border border-ink/20 bg-white px-4 py-2.5 text-base outline-none focus:border-forest sm:w-72"
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
              className="block rounded-2xl border border-ink/10 bg-white p-3 text-center shadow-sm transition hover:border-forest/40 hover:shadow-md"
            >
              {geneImages.has(g.slug) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/genes/${g.slug}.jpg`}
                  alt={`${g.display} — Face of RP`}
                  className="aspect-square w-full rounded-xl object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="grid aspect-square w-full place-items-center rounded-xl bg-cream-card text-2xl text-forest/40"
                >
                  🧬
                </span>
              )}
              <span className="mt-3 block font-display text-lg font-bold text-ink">
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
