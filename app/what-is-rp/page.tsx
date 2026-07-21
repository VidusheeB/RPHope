import type { Metadata } from "next";
import Eyebrow from "@/components/site/Eyebrow";
import CTAButton from "@/components/site/CTAButton";
import {
  SourcesList,
  EducationalDisclaimer,
  type Source,
} from "@/components/site/ExplainerNotes";

export const metadata: Metadata = {
  title: "What is retinitis pigmentosa (RP)?",
  description:
    "A clear, everyday-language explainer of retinitis pigmentosa — what it is, how vision changes over time, the genetics behind it, how it's diagnosed, and where research stands.",
};

// Educational explainer summarizing established facts about RP from the
// National Eye Institute (NIH) and MedlinePlus Genetics. Contains medical
// content, so it shows an educational disclaimer, a last-reviewed date, and
// cited sources per content governance. Wording should be verified by a
// reviewer before this is treated as final published copy.
const sources: Source[] = [
  {
    label:
      "National Eye Institute (NIH) — Retinitis Pigmentosa",
    href: "https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/retinitis-pigmentosa",
  },
  {
    label: "MedlinePlus Genetics — Retinitis pigmentosa",
    href: "https://medlineplus.gov/genetics/condition/retinitis-pigmentosa/",
  },
];

const sections = [
  {
    heading: "What is RP?",
    body: [
      "Retinitis pigmentosa (RP) is a group of rare, inherited eye diseases that affect the retina — the light-sensitive layer of tissue at the back of the eye that turns light into signals your brain reads as sight.",
      "In RP, the cells in the retina slowly break down over time, which gradually reduces vision. It is a genetic condition, meaning people are born with it, and symptoms most often begin in childhood.",
    ],
  },
  {
    heading: "How vision changes over time",
    body: [
      "The usual first sign is trouble seeing at night or in dim light, often noticed in childhood.",
      "Next, side (peripheral) vision narrows, which can create a kind of “tunnel vision.” Over many years, the field of clear vision continues to shrink.",
      "Some people also notice sensitivity to bright light or changes in color vision. RP progresses at very different rates from person to person.",
    ],
  },
  {
    heading: "Causes and genetics",
    body: [
      "RP is caused by changes (variants) in genes that keep retinal cells healthy. Those gene changes are passed from parents to children, in patterns that can be autosomal recessive, autosomal dominant, or X-linked depending on the gene.",
      "Sometimes RP occurs as part of a broader condition, such as Usher syndrome, which affects both vision and hearing.",
    ],
  },
  {
    heading: "RP is organized by gene",
    body: [
      "RP isn't one single condition with one single cause — it's a group of conditions that all lead to vision loss, but each is driven by a change in a different gene. More than 80 genes have been linked to RP so far, and the specific gene involved shapes how a person's RP behaves: how early it starts, how quickly it progresses, which symptoms come first, and — increasingly — which treatments or trials may be relevant.",
      "A few genes account for a large share of cases. RHO is the most common gene linked to autosomal dominant RP, responsible for an estimated 20–30% of those cases. USH2A is the most common gene linked to autosomal recessive RP, and also the most common cause of Usher syndrome type II (RP combined with hearing loss). RPGR is a common cause of X-linked RP, and PDE6A and PDE6B together account for roughly 2–5% of autosomal recessive cases. Dozens of other genes — including ABCA4, RP1, KCNV2, and CYP4V2 — each cause a smaller share of cases.",
      "This is why RP Hope organizes its Genetic Insights library gene by gene rather than treating RP as one disease: the research, the treatment outlook, and even the patient community can look very different depending on which gene is involved.",
    ],
  },
  {
    heading: "How it's diagnosed",
    body: [
      "Eye doctors use several tests together: a dilated eye exam, visual field testing to map side vision, an electroretinogram (ERG) to measure how the retina responds to light, and OCT imaging for a detailed picture of the retina.",
      "Genetic testing identifies the specific gene involved. This is how the exact form of RP is confirmed — not from symptoms alone.",
    ],
  },
  {
    heading: "Finding out your gene — and what to do next",
    body: [
      "The only way to know for certain which gene is involved is genetic testing — usually a blood or saliva sample, ordered by an eye doctor or genetic counselor. Symptoms alone can't tell you the gene, because different genes can cause very similar vision changes.",
      "Knowing your gene matters: it can explain how your RP is likely to progress, connect you with the research and clinical trials most relevant to that specific gene, and — for a small but growing number of genes — point to an approved or investigational treatment aimed at it directly.",
      "If you already know your gene, you can go straight to its page in Genetic Insights. If you don't yet, or aren't sure where to start, My RP Pathway will ask a few quick questions and build a short, guided tour of the site for you.",
    ],
    cta: { href: "/my-pathway", label: "Start My RP Pathway" },
  },
  {
    heading: "Where treatment and research stand",
    body: [
      "There is no cure for most forms of RP yet, but the picture is changing. Low-vision aids and rehabilitation help people make the most of the vision they have.",
      "For one specific genetic form (caused by RPE65 gene changes), an approved gene therapy exists. Many more gene therapies, cell therapies, and other approaches are being studied in clinical trials right now.",
      "This is exactly why RP Hope exists — to track that research gene by gene and help you find studies that may be relevant to review.",
    ],
  },
];

export default function WhatIsRpPage() {
  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-3xl px-5 py-16">
        <Eyebrow>Understanding RP</Eyebrow>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
          What is{" "}
          <span className="italic font-medium text-gold">
            retinitis pigmentosa?
          </span>
        </h1>
        <p className="mt-6 text-xl leading-relaxed text-ink/80">
          A rare, inherited eye disease that gradually changes vision — here in
          clear, everyday language.
        </p>

        <div className="mt-12 space-y-10">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="font-display text-2xl font-medium tracking-tight text-forest">
                {s.heading}
              </h2>
              <div className="mt-3 space-y-3 text-lg leading-relaxed text-ink/80">
                {s.body.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              {"cta" in s && s.cta && (
                <div className="mt-5">
                  <CTAButton href={s.cta.href} variant="primary" arrow>
                    {s.cta.label}
                  </CTAButton>
                </div>
              )}
            </section>
          ))}
        </div>

        <EducationalDisclaimer />

        <p className="mt-4 text-sm text-ink/55">Last reviewed: July 2026</p>

        <SourcesList sources={sources} />

        <div className="mt-12 flex flex-wrap gap-4">
          <CTAButton href="/genetic-insights" variant="primary" arrow>
            Explore genes linked to RP
          </CTAButton>
          <CTAButton href="/what-is-a-clinical-trial" variant="secondary" arrow>
            What is a clinical trial?
          </CTAButton>
        </div>
      </div>
    </div>
  );
}
