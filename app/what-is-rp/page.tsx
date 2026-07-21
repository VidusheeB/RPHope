import type { Metadata } from "next";
import Link from "next/link";
import Eyebrow from "@/components/site/Eyebrow";
import CTAButton from "@/components/site/CTAButton";
import {
  SourcesList,
  EducationalDisclaimer,
  type Source,
} from "@/components/site/ExplainerNotes";
import {
  ExplainerSections,
  type ExplainerSection,
} from "@/components/site/ExplainerSections";

export const metadata: Metadata = {
  title: "Understanding RP",
  description:
    "A clear, everyday-language explainer of retinitis pigmentosa — what it is, how vision changes over time, the genetics behind it, how it's diagnosed, and where treatment and support stand.",
};

// Educational explainer summarizing established facts about RP from the
// National Eye Institute (NIH), MedlinePlus Genetics, and the FDA. Contains
// medical content, so it shows an educational disclaimer, a last-reviewed
// date, and cited sources per content governance. Wording should be
// verified by a reviewer before this is treated as final published copy.
const sources: Source[] = [
  {
    label: "National Eye Institute, National Institutes of Health — Retinitis Pigmentosa",
    href: "https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/retinitis-pigmentosa",
  },
  {
    label: "MedlinePlus Genetics, National Library of Medicine — Retinitis Pigmentosa",
    href: "https://medlineplus.gov/genetics/condition/retinitis-pigmentosa/",
  },
  {
    label: "U.S. Food and Drug Administration — LUXTURNA",
    href: "https://www.fda.gov/vaccines-blood-biologics/cellular-gene-therapy-products/luxturna-voretigene-neparvovec-rzyl",
  },
  {
    label: "RP Hope legacy website — Genetic Insights",
  },
];

const sections: ExplainerSection[] = [
  {
    heading: "What is retinitis pigmentosa?",
    blocks: [
      {
        type: "p",
        text: "Retinitis pigmentosa, commonly called RP, is a group of inherited eye conditions that affect the retina. The retina is the light-sensitive tissue at the back of the eye that turns light into signals the brain recognizes as sight.",
      },
      {
        type: "p",
        text: "RP causes some of the retina's light-sensing cells, called photoreceptors, to gradually deteriorate. This leads to vision loss that usually develops over many years.",
      },
      {
        type: "p",
        text: "RP affects everyone differently. The symptoms, age of onset, and rate of progression can vary greatly, even among members of the same family.",
      },
    ],
  },
  {
    heading: "How vision changes over time",
    blocks: [
      {
        type: "p",
        text: "For many people, the first noticeable sign of RP is difficulty seeing at night or in dimly lit places. It may take longer for their eyes to adjust when entering a dark room, or they may have trouble moving around safely at night.",
      },
      {
        type: "p",
        text: "Peripheral vision often begins to narrow later. A person may not notice objects, steps, or people approaching from the side. As more peripheral vision is lost, this can create what is often described as “tunnel vision.”",
      },
      {
        type: "p",
        text: "RP can eventually affect central vision, which is used for reading, recognizing faces, driving, and seeing fine details. Some people also experience sensitivity to bright light or changes in color vision.",
      },
      {
        type: "p",
        text: "These changes do not follow the same timeline for everyone. Some forms of RP progress slowly over decades, while others cause significant vision loss much earlier.",
      },
    ],
  },
  {
    heading: "Causes and genetics",
    blocks: [
      {
        type: "p",
        text: "RP is caused by changes in genes that the retina needs to develop, function, and remain healthy. These genetic changes are often called variants or mutations.",
      },
      {
        type: "p",
        text: "Depending on the gene involved, RP may be inherited in different ways:",
      },
      {
        type: "list",
        items: [
          "**Autosomal dominant:** A person inherits one altered copy of a gene from one parent.",
          "**Autosomal recessive:** A person inherits an altered copy of a gene from each parent. The parents are usually unaffected carriers.",
          "**X-linked:** The altered gene is located on the X chromosome. These forms often affect males more severely, although some female carriers also develop vision loss.",
        ],
      },
      {
        type: "p",
        text: "A person can have RP even when no one else in the family is known to have it. Parents may carry a recessive variant without having symptoms, the condition may not have been recognized in earlier generations, or a genetic change may have occurred for the first time in that person.",
      },
      {
        type: "p",
        text: "RP sometimes occurs as part of a condition that affects more than the eyes. Usher syndrome, for example, causes both RP and hearing loss.",
      },
    ],
  },
  {
    heading: "RP is organized by gene",
    blocks: [
      {
        type: "p",
        text: "RP is not one disease with one cause. Disease-causing variants in more than 130 genes are known to cause it, and researchers continue to learn more about how those genes affect the retina.",
      },
      {
        type: "p",
        text: "Some of the more common RP genes include **RHO, USH2A, and RPGR**, but many others are involved. Each gene plays a different role in the retina, and changes in different genes can produce different patterns of vision loss.",
      },
      { type: "p", text: "The gene involved may influence:" },
      {
        type: "list",
        items: [
          "When symptoms are likely to begin",
          "Which parts of vision are affected first",
          "How the condition is inherited",
          "Whether hearing or other parts of the body may also be affected",
          "Which research studies or clinical trials may be relevant",
        ],
      },
      {
        type: "p",
        text: "Even people with changes in the same gene can have different experiences. A genetic result can provide useful information, but it cannot predict exactly how one person's vision will change.",
      },
      {
        type: "node",
        content: (
          <p>
            This is why RP Hope organizes its{" "}
            <strong className="font-semibold text-ink">
              Genetic Insights
            </strong>{" "}
            library by gene. Each page brings together information about what
            the gene does, how changes in it affect the retina, what
            researchers have learned, and which treatments or clinical trials
            are being explored. The original RP Hope website also used a
            gene-centered approach to collect research papers, articles, and
            patient experiences related to individual genetic forms of RP.
          </p>
        ),
      },
    ],
  },
  {
    heading: "How it's diagnosed",
    blocks: [
      {
        type: "p",
        text: "RP is usually diagnosed by an ophthalmologist, often one who specializes in the retina or inherited retinal diseases.",
      },
      { type: "p", text: "The evaluation may include:" },
      {
        type: "list",
        items: [
          "A **dilated eye exam** to look closely at the retina",
          "**Visual field testing** to measure peripheral vision",
          "An **electroretinogram**, or ERG, to measure how the retina responds to light",
          "**Optical coherence tomography**, or OCT, to create detailed images of the retina",
          "**Fundus autofluorescence imaging** to show patterns of change in the retina",
          "**Genetic testing** to look for the underlying genetic cause",
        ],
      },
      {
        type: "p",
        text: "No single test tells the whole story. Doctors consider the results alongside a person's symptoms, medical history, and family history.",
      },
      {
        type: "p",
        text: "Genetic testing can identify the cause of RP for many people, but it does not provide a clear answer in every case. An inconclusive result does not mean that a person does not have RP. The result may become more useful later as testing improves and researchers learn more about previously uncertain variants.",
      },
    ],
  },
  {
    heading: "Finding out your gene — and what to do next",
    blocks: [
      {
        type: "p",
        text: "Genetic testing usually uses a blood or saliva sample. It may be ordered by an ophthalmologist, inherited retinal disease specialist, or genetic counselor.",
      },
      { type: "p", text: "Knowing your gene can help you:" },
      {
        type: "list",
        items: [
          "Better understand how your RP may have been inherited",
          "Learn whether family members could also be affected or carry the variant",
          "Find research focused on your genetic form of RP",
          "Identify clinical trials that may be relevant",
          "Learn whether a gene-specific treatment is available or being studied",
        ],
      },
      {
        type: "p",
        text: "Genetic results can be complicated. A genetic counselor or qualified eye specialist can explain what the result means, what it does not mean, and whether testing other family members may be useful.",
      },
      {
        type: "node",
        content: (
          <p>
            Already know your gene? Visit its page in{" "}
            <Link
              href="/genetic-insights"
              className="font-semibold text-forest underline hover:text-forest-dark"
            >
              Genetic Insights
            </Link>
            .
          </p>
        ),
      },
      {
        type: "node",
        content: (
          <p>
            If you do not know your gene or are unsure where to begin,{" "}
            <Link
              href="/my-pathway"
              className="font-semibold text-forest underline hover:text-forest-dark"
            >
              My RP Pathway
            </Link>{" "}
            can guide you toward genetic testing information, research,
            practical resources, and other parts of RP Hope based on where
            you are now.
          </p>
        ),
      },
    ],
    cta: { href: "/my-pathway", label: "Start My RP Pathway" },
  },
  {
    heading: "Treatment and support",
    blocks: [
      {
        type: "p",
        text: "There is currently no cure for most forms of RP, but care and support can help people adapt as their vision changes.",
      },
      {
        type: "p",
        text: "Low-vision rehabilitation, orientation and mobility training, accessible technology, and other tools can help people continue working, studying, traveling, and managing daily life. Regular eye care is also important because people with RP may develop additional conditions, such as cataracts or swelling in the retina, that can sometimes be treated.",
      },
      {
        type: "p",
        text: "An FDA-approved gene therapy called **LUXTURNA** is available for certain people with an inherited retinal disease caused by disease-causing variants in both copies of the **RPE65** gene. It does not treat RP caused by other genes.",
      },
      {
        type: "p",
        text: "Researchers are studying many other approaches, including gene therapies, medicines, cell therapies, optogenetics, and technologies designed to restore useful vision.",
      },
    ],
    cta: { href: "/future-therapies", label: "Explore Future Therapies" },
  },
];

export default function WhatIsRpPage() {
  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-3xl px-5 py-16">
        <Eyebrow>Retinitis Pigmentosa</Eyebrow>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
          Understanding{" "}
          <span className="italic font-medium text-gold">RP</span>
        </h1>
        <p className="mt-6 text-xl leading-relaxed text-ink/80">
          A rare, inherited eye disease that gradually changes vision — here in
          clear, everyday language.
        </p>

        <ExplainerSections sections={sections} />

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
