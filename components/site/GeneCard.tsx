import Link from "next/link";

export type GeneCardData = {
  gene: string;
  slug: string;
  summary: string;
  tag: string;
  tagTone: "mint" | "butter" | "lilac";
};

const tagStyles: Record<GeneCardData["tagTone"], string> = {
  mint: "bg-mint text-forest",
  butter: "bg-butter text-[#8a6d1f]",
  lilac: "bg-lilac text-[#5b51a3]",
};

export default function GeneCard({ data }: { data: GeneCardData }) {
  return (
    <article className="flex flex-col rounded-2xl border border-ink/10 bg-white p-6 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-2xl font-bold text-ink">{data.gene}</h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${tagStyles[data.tagTone]}`}
        >
          {data.tag}
        </span>
      </div>
      <p className="mt-4 flex-1 leading-relaxed text-ink/75">{data.summary}</p>
      <Link
        href={`/genetic-insights/${data.slug}`}
        className="mt-5 inline-flex items-center gap-2 font-bold text-forest hover:underline"
      >
        View insight <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}
