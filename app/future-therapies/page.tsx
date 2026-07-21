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
  title: "Future therapies for RP",
  description:
    "A clear, everyday-language look at where RP treatment and research stand today — from LUXTURNA, the one FDA-approved therapy, to gene editing, RNA-based treatments, cell therapies, optogenetics, and other approaches in development.",
};

// Educational explainer summarizing RP treatment and research approaches
// from the National Eye Institute, the FDA, ClinicalTrials.gov, and the
// RP Hope legacy site. Contains medical/research content, so it carries an
// educational disclaimer, a last-reviewed date, and cited sources per
// content governance. Wording should be verified by a reviewer before this
// is treated as final published copy.
const sources: Source[] = [
  {
    label: "National Eye Institute, National Institutes of Health — Retinitis Pigmentosa and research updates",
    href: "https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/retinitis-pigmentosa",
  },
  {
    label: "U.S. Food and Drug Administration — LUXTURNA",
    href: "https://www.fda.gov/vaccines-blood-biologics/cellular-gene-therapy-products/luxturna-voretigene-neparvovec-rzyl",
  },
  {
    label: "ClinicalTrials.gov — Retinitis pigmentosa research studies",
    href: "https://clinicaltrials.gov/search?cond=Retinitis%20Pigmentosa",
  },
  {
    label: "RP Hope legacy website — Future Therapies",
  },
  {
    label: "Johns Hopkins Wilmer Eye Institute — NAC Attack Clinical Trial",
    href: "https://clinicaltrials.gov/study/NCT03063021",
  },
];

const sections: ExplainerSection[] = [
  {
    heading: "Where treatment and research stand",
    blocks: [
      {
        type: "p",
        text: "There is currently no cure for most forms of retinitis pigmentosa, but RP research has expanded significantly.",
      },
      {
        type: "p",
        text: "Researchers are working on treatments that address different stages and causes of the condition. Some aim to correct the genetic problem that causes retinal cells to deteriorate. Others are designed to protect the cells that remain or restore useful vision after many photoreceptors have already been lost.",
      },
      {
        type: "p",
        text: "These approaches are at very different stages. Some are being tested in large clinical trials, while others have only been studied in cells or animals. A promising laboratory result does not necessarily mean that a treatment is close to becoming available.",
      },
    ],
  },
  {
    heading: "The treatment available today",
    blocks: [
      {
        type: "p",
        text: "**LUXTURNA** is an FDA-approved gene therapy for certain people with an inherited retinal disease caused by disease-causing variants in both copies of the **RPE65** gene.",
      },
      {
        type: "p",
        text: "The treatment delivers a working copy of the RPE65 gene directly beneath the retina. A person must have confirmed genetic results and enough viable retinal cells remaining to be eligible.",
      },
      {
        type: "p",
        text: "LUXTURNA was an important milestone because it showed that an inherited retinal disease could be treated by addressing its genetic cause. However, it does not treat RP caused by other genes.",
      },
    ],
  },
  {
    heading: "What researchers are trying to accomplish",
    blocks: [
      {
        type: "p",
        text: "Most future RP therapies are designed around one of three goals:",
      },
      {
        type: "list",
        items: [
          "**Slow or prevent further damage** by protecting retinal cells that are still working",
          "**Address the underlying cause** by replacing, repairing, or changing how a gene is used",
          "**Restore useful vision** by replacing lost cells or helping other cells respond to light",
        ],
      },
      {
        type: "p",
        text: "Which approach may be relevant depends partly on the gene involved and how much functioning retina remains.",
      },
    ],
  },
  {
    heading: "Gene replacement therapy",
    blocks: [
      {
        type: "p",
        text: "Gene replacement therapy delivers a working copy of a gene to retinal cells. The new copy does not remove the original variant. Instead, it gives the cells instructions they can use to produce a working protein.",
      },
      {
        type: "p",
        text: "This approach is generally most suitable when RP is caused by a gene that is not producing enough functional protein. Because each therapy is usually designed around a particular gene, separate treatments may be needed for different genetic forms of RP.",
      },
      {
        type: "p",
        text: "Researchers are studying gene therapies for several RP genes, including forms associated with **RPGR, RHO, PDE6A, and PDE6B**. Other approaches, sometimes called modifier gene therapies, are being studied with the goal of helping people with more than one genetic form of RP. Gene therapies for RP range from early research to late-stage clinical trials.",
      },
    ],
  },
  {
    heading: "Gene editing",
    blocks: [
      {
        type: "p",
        text: "Gene editing aims to change the DNA already inside a person's cells. Technologies such as CRISPR can be designed to remove, disable, or correct a harmful genetic instruction.",
      },
      {
        type: "p",
        text: "This may be useful for dominant forms of RP, in which an altered gene produces a protein that actively interferes with the retina. In these cases, simply adding another working copy of the gene may not be enough.",
      },
      {
        type: "p",
        text: "Researchers have used gene editing to correct an RP-causing **RHO** variant in a mouse model and improve retinal structure and function. This work remains preclinical and must undergo further testing before it could become a treatment for patients.",
      },
    ],
  },
  {
    heading: "RNA-based treatments",
    blocks: [
      {
        type: "p",
        text: "Genes contain instructions for making proteins, but those instructions first pass through a molecule called RNA. RNA-based treatments aim to change how those instructions are read or processed without permanently changing the DNA.",
      },
      { type: "p", text: "Depending on the genetic problem, an RNA treatment may:" },
      {
        type: "list",
        items: [
          "Help the cell skip over a harmful section of genetic instructions",
          "Reduce the production of a damaging protein",
          "Allow the cell to produce a more useful version of a protein",
        ],
      },
      {
        type: "p",
        text: "These treatments can be highly specific. A therapy may apply only to people with a particular variant or a particular section of a gene. RNA-based treatments have entered clinical development for inherited retinal conditions associated with genes including **USH2A**.",
      },
    ],
  },
  {
    heading: "Treatments that protect remaining vision",
    blocks: [
      {
        type: "p",
        text: "Not every treatment under study is designed around one gene. Researchers are also studying treatments that act on processes shared by many forms of RP.",
      },
      {
        type: "p",
        text: "When rod cells deteriorate, the environment inside the retina changes. Oxidative stress, inflammation, and other forms of cell stress may contribute to the later loss of cone cells. Neuroprotective treatments aim to reduce that damage and keep the remaining photoreceptors working for longer.",
      },
      {
        type: "p",
        text: "One example is **N-acetylcysteine**, or NAC, an antioxidant being evaluated in a Phase 3 clinical trial to determine whether it can safely slow vision loss in people with RP. NAC is still investigational for RP and should not be used for this purpose without medical guidance.",
      },
      {
        type: "p",
        text: "Researchers are also exploring other antioxidants, anti-inflammatory medicines, growth factors, and small molecules that affect pathways involved in retinal-cell survival. Because these treatments do not necessarily depend on one gene, some may eventually apply to several forms of RP.",
      },
    ],
  },
  {
    heading: "Cell therapies and retinal regeneration",
    blocks: [
      {
        type: "p",
        text: "Cell therapies explore whether damaged retinal cells can be supported or replaced.",
      },
      {
        type: "p",
        text: "Some treatments use cells that release substances intended to help the remaining photoreceptors survive. Others aim to transplant new photoreceptors or retinal cells to replace those that have been lost.",
      },
      {
        type: "p",
        text: "Researchers also use stem cells to grow **retinal organoids**, small models of retinal tissue created in a laboratory. Organoids allow scientists to study how a person's genetic variant affects retinal cells and test possible treatments before they are used in people.",
      },
      {
        type: "p",
        text: "Cell transplantation is challenging because new cells must survive, connect with the existing retina, and communicate with the brain. Although cell-based treatments are being studied in people, they remain experimental.",
      },
    ],
  },
  {
    heading: "Optogenetics",
    blocks: [
      {
        type: "p",
        text: "Optogenetics is being studied mainly for people with advanced vision loss whose photoreceptors no longer respond effectively to light.",
      },
      {
        type: "p",
        text: "Instead of replacing the lost photoreceptors, optogenetic treatments introduce a light-sensitive protein into other surviving retinal cells. The goal is to allow those cells to detect light and send information through the optic nerve to the brain.",
      },
      {
        type: "p",
        text: "Several optogenetic treatments have entered human clinical trials. Some are used with specialized glasses or other equipment that process visual information before it reaches the treated eye. The goal is to provide useful visual information, such as the location or shape of an object, rather than recreate ordinary sight.",
      },
    ],
  },
  {
    heading: "Retinal prostheses and vision-restoration devices",
    blocks: [
      {
        type: "p",
        text: "Retinal prostheses and related devices attempt to bypass photoreceptors that no longer work.",
      },
      {
        type: "p",
        text: "These systems may use a camera, implanted electrodes, light-sensitive materials, or other technology to stimulate the remaining retina or another part of the visual pathway.",
      },
      {
        type: "p",
        text: "The information they provide is much more limited than natural vision. Researchers are working to improve image detail, comfort, reliability, and the brain's ability to interpret the signals.",
      },
    ],
  },
  {
    heading: "Other early-stage approaches",
    blocks: [
      {
        type: "p",
        text: "The original RP Hope website also followed several less established areas of research. These include:",
      },
      {
        type: "list",
        items: [
          "**Nanobodies:** Very small antibody fragments that can bind to a particular protein. Researchers have developed nanobodies that stabilize altered forms of rhodopsin, the protein produced by the **RHO** gene. This work remains at an early laboratory stage.",
          "**N-acetylcysteine amide, or NACA:** An antioxidant compound designed to enter cells more easily and reduce oxidative damage. Research related to RP has largely remained preclinical.",
          "**Exosomes:** Tiny packages released by cells that carry proteins, genetic material, and other signals. Researchers are studying whether exosomes could protect retinal cells or deliver treatments, but their safety and effectiveness for RP have not been established.",
          "**Light-activated medicines:** Compounds designed to make surviving retinal cells respond to light. Like optogenetics, these approaches may eventually offer a way to restore limited visual function without repairing the original RP gene.",
          "**Cell reprogramming:** An early research strategy that attempts to encourage cells already present in the retina to become new photoreceptors or support retinal repair.",
        ],
      },
      {
        type: "p",
        text: "These ideas are scientifically promising, but most remain much further from routine patient care than treatments already in clinical trials.",
      },
    ],
  },
  {
    heading: "From research to an approved treatment",
    blocks: [
      { type: "p", text: "A possible therapy usually passes through several stages:" },
      {
        type: "list",
        items: [
          "**Laboratory research:** Scientists test the idea in cells, retinal organoids, or other laboratory models.",
          "**Preclinical research:** The treatment is studied in animals to examine its effects and possible risks.",
          "**Phase 1 clinical trials:** A small number of participants receive the treatment, with the main focus on safety and dosage.",
          "**Phase 2 clinical trials:** Researchers continue studying safety and look for evidence that the treatment may work.",
          "**Phase 3 clinical trials:** The treatment is tested in a larger group, often against a placebo, sham procedure, or current standard of care.",
          "**Regulatory review:** Agencies such as the FDA review the evidence and decide whether the treatment should be approved.",
        ],
      },
      {
        type: "p",
        text: "Many possible therapies do not make it through every stage. Clinical trials are designed to find out whether a treatment truly works and whether its benefits outweigh its risks.",
      },
    ],
  },
  {
    heading: "Which therapies may be relevant to you?",
    blocks: [
      { type: "p", text: "A therapy or clinical trial may depend on:" },
      {
        type: "list",
        items: [
          "The gene involved",
          "The specific variant within that gene",
          "How the condition is inherited",
          "The amount and location of functioning retina that remains",
          "Age, general health, and previous treatments",
          "The eligibility requirements and location of a clinical trial",
        ],
      },
      {
        type: "p",
        text: "Knowing your gene does not guarantee that a treatment or trial is available. However, it can help narrow the search and connect you with research that is most relevant to your form of RP.",
      },
      {
        type: "node",
        content: (
          <p>
            Visit{" "}
            <Link
              href="/genetic-insights"
              className="font-semibold text-forest underline hover:text-forest-dark"
            >
              Genetic Insights
            </Link>{" "}
            to explore research by gene.
          </p>
        ),
      },
      {
        type: "node",
        content: (
          <p>
            Use the{" "}
            <Link
              href="/clinical-trials"
              className="font-semibold text-forest underline hover:text-forest-dark"
            >
              Clinical Trials Finder
            </Link>{" "}
            to look for studies that may be relevant to review with your
            medical team.
          </p>
        ),
      },
      {
        type: "node",
        content: (
          <p>
            Not sure where to begin?{" "}
            <Link
              href="/my-pathway"
              className="font-semibold text-forest underline hover:text-forest-dark"
            >
              My RP Pathway
            </Link>{" "}
            can guide you toward the next step.
          </p>
        ),
      },
    ],
  },
  {
    heading: "A note about experimental treatments",
    blocks: [
      {
        type: "p",
        text: "A treatment described in a research article or listed in a clinical trial is not necessarily proven to be safe or effective. Decisions about genetic testing, treatment, supplements, or clinical-trial participation should be discussed with a qualified eye specialist or genetic counselor.",
      },
    ],
  },
];

export default function FutureTherapiesPage() {
  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-3xl px-5 py-16">
        <Eyebrow>Understanding research</Eyebrow>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
          Future{" "}
          <span className="italic font-medium text-gold">therapies</span> for
          RP
        </h1>
        <p className="mt-6 text-xl leading-relaxed text-ink/80">
          A clear look at where RP research stands today — from the one
          approved treatment to the ideas still being tested in the lab.
        </p>

        <ExplainerSections sections={sections} />

        <EducationalDisclaimer />

        <p className="mt-4 text-sm text-ink/55">Last reviewed: July 2026</p>

        <SourcesList sources={sources} />

        <div className="mt-12 flex flex-wrap gap-4">
          <CTAButton href="/clinical-trials" variant="primary" arrow>
            Open the Clinical Trials Finder
          </CTAButton>
          <CTAButton href="/what-is-rp" variant="secondary" arrow>
            Back to Understanding RP
          </CTAButton>
        </div>
      </div>
    </div>
  );
}
