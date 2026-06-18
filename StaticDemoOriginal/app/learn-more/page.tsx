import type { Metadata } from "next";
import FillerBox from "@/components/FillerBox";

export const metadata: Metadata = {
  title: "Learn More about RP — RP Hope",
  description:
    "An introduction to retinitis pigmentosa (RP): what it is, its symptoms, and how it is inherited.",
};

const articles = [
  { date: "Dec 6, 2024", title: "Hormones and protein development in females" },
  { date: "Jan 31, 2022", title: "MalaCards: The human disease database" },
  { date: "Jan 1, 2022", title: "Retinitis Pigmentosa Pathway" },
  { date: "Oct 13, 2020", title: "Rosie's Story: Treating Retinitis Pigmentosa" },
  { date: "May 23, 2019", title: "Genes and mutations causing retinitis pigmentosa" },
  { date: "Sep 1, 2015", title: "A look at autoimmunity and inflammation in the eye" },
];

export default function LearnMorePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="border-y-4 border-double border-teal py-2 font-display text-4xl font-bold uppercase tracking-tight text-teal-dark">
        Learn More about RP
      </h1>

      <p className="mt-6 max-w-4xl leading-relaxed text-teal-dark/90">
        Retinitis pigmentosa (RP) is a rare genetic eye disease that causes
        progressive vision loss. RP causes the light-sensing cells in the retina
        to break down over time, leading to vision loss. Symptoms include
        difficulty seeing at night or in low light, loss of peripheral vision,
        also known as tunnel vision, sensitivity to bright light, and loss of
        color vision. RP is a chronic condition that progresses over years or
        decades. Many people with RP are legally blind by age 40. RP is usually
        caused by changes in the genes that control cells in the retina. These
        changes can be passed down from parents to children. Other genes include
        medicines, infections, and eye injuries. At this time, there is no cure
        for RP, but medications can help treat some complications. A medical
        professional can diagnose RP and manage the condition to improve
        symptoms.
      </p>

      <h2 className="mt-10 font-display text-2xl font-semibold uppercase tracking-tight text-link">
        Articles about Retinitis Pigmentosa
      </h2>
      <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {articles.map((a) => (
          <li
            key={a.title}
            className="flex flex-col rounded-lg border border-teal/15 bg-white p-3 shadow-sm"
          >
            <FillerBox label="Article image" className="aspect-[4/3] w-full" />
            <span className="mt-3 text-xs text-teal-dark/60">{a.date}</span>
            <span className="mt-1 font-semibold leading-snug text-teal-dark">
              {a.title}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
