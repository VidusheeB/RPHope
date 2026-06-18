import Link from "next/link";
import type { Gene } from "@/lib/genes";

export default function GeneCard({ gene }: { gene: Gene }) {
  return (
    <li className="h-full">
      <Link
        href={`/genetic-insights/${gene.slug}`}
        className="flex h-full flex-col rounded-lg border border-teal/20 bg-white p-5 shadow-sm transition hover:border-link hover:shadow-md"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-2xl font-bold text-teal">
            {gene.gene}
          </span>
          <span className="rounded-full bg-cream px-2.5 py-1 text-xs font-semibold text-teal-dark">
            {gene.diseaseCategory}
          </span>
        </div>
        {gene.fullName && (
          <span className="mt-1 text-sm text-teal-dark/70">{gene.fullName}</span>
        )}
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-teal-dark/90">
          {gene.summary}
        </p>
        <span className="mt-4 text-sm font-semibold text-link">
          View gene →
        </span>
      </Link>
    </li>
  );
}
