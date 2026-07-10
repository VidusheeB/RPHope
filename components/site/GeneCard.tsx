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
    <article className="flex flex-col rounded-lg border border-ink/12 bg-white p-6 transition hover:border-forest/40">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-sans text-2xl font-bold tracking-tight text-ink">{data.gene}</h3>
        <span
          className={`rounded px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-wide ${tagStyles[data.tagTone]}`}
        >
          {data.tag}
        </span>
      </div>
      <p className="mt-4 flex-1 leading-relaxed text-ink/75">{data.summary}</p>
      <Link
        href={`/genetic-insights/${data.slug}`}
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.06em] text-forest hover:text-forest-dark"
      >
        View insight <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}
