"use client";

// True rendered preview of the DRAFT — reuses the exact same components the
// public gene page renders with (GeneDraftView, GENE_COL, GeneCrumb,
// GeneFooter, GeneArticles), never a second hand-maintained page design.
// Renders draft content only; never the published snapshot, never internal
// reviewer/admin metadata.

import { useState } from "react";
import type { GenePageDraft } from "@/lib/geneResearch/types";
import type { Article } from "@/components/site/GeneArticles";
import GeneArticles from "@/components/site/GeneArticles";
import GeneDraftView from "@/components/review/GeneDraftView";
import { GENE_COL, GeneCrumb, GeneFooter } from "@/components/site/genePageParts";

export default function PreviewTab({
  draft,
  geneSlug,
  articles,
  hasPublishedVersion,
}: {
  draft: GenePageDraft;
  geneSlug: string;
  articles: Article[];
  hasPublishedVersion: boolean;
}) {
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold/40 bg-butter/40 px-4 py-2 text-sm">
        <span className="font-semibold text-ink">
          Draft preview — not live. This is what {geneSlug.toUpperCase()} would look like if published right now.
        </span>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-ink/20 bg-white p-0.5" role="group" aria-label="Viewport">
            <button
              type="button"
              onClick={() => setViewport("desktop")}
              aria-pressed={viewport === "desktop"}
              className={`rounded px-2 py-1 text-xs font-semibold ${viewport === "desktop" ? "bg-forest text-white" : "text-ink/60"}`}
            >
              Desktop
            </button>
            <button
              type="button"
              onClick={() => setViewport("mobile")}
              aria-pressed={viewport === "mobile"}
              className={`rounded px-2 py-1 text-xs font-semibold ${viewport === "mobile" ? "bg-forest text-white" : "text-ink/60"}`}
            >
              Mobile
            </button>
          </div>
          {hasPublishedVersion && (
            <a
              href={`/genetic-insights/${geneSlug}`}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-ink/20 px-2 py-1 text-xs font-semibold text-ink hover:border-forest"
            >
              View current live page
            </a>
          )}
        </div>
      </div>

      <div
        className={`mx-auto mt-6 overflow-x-auto rounded-lg border border-ink/10 bg-cream ${
          viewport === "mobile" ? "max-w-[26rem]" : "max-w-full"
        }`}
      >
        <article className={`${GENE_COL} px-5 py-12`}>
          <GeneCrumb />
          <div className="mt-2">
            <GeneDraftView draft={draft} geneSlug={geneSlug} />
          </div>
          <div className={GENE_COL}>
            {articles.length > 0 && (
              <section className="mt-12">
                <h2 className="font-display text-3xl font-medium tracking-tight text-ink">In the News</h2>
                <div className="mt-6">
                  <GeneArticles articles={articles} />
                </div>
              </section>
            )}
            <GeneFooter lastReviewed="draft preview" />
          </div>
        </article>
      </div>
    </div>
  );
}
