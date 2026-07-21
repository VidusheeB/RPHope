import type { Metadata } from "next";
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
  title: "What is a clinical trial?",
  description:
    "A clear, everyday-language explainer of clinical trials — interventional vs. observational studies, the phases, what taking part involves, eligibility, informed consent, participant protections, and what a study's status means.",
};

// Educational explainer summarizing standard clinical-trial concepts from
// ClinicalTrials.gov (NLM), the FDA, and NIMH. Contains medical/research
// content, so it carries an educational disclaimer and cited sources.
// Framing deliberately mirrors the Clinical Trials Finder's governance:
// studies "may be relevant to review," never eligibility. A couple of
// source bullets have no confirmed URL and are left as plain citations
// rather than guessed links. Verify wording before treating as final copy.
const sources: Source[] = [
  {
    label: "ClinicalTrials.gov, National Library of Medicine — Learn About Studies",
    href: "https://clinicaltrials.gov/study-basics/learn-about-studies",
  },
  {
    label: "ClinicalTrials.gov, National Library of Medicine — Glossary",
    href: "https://clinicaltrials.gov/policy/protocol-definitions",
  },
  {
    label: "ClinicalTrials.gov, National Library of Medicine — How to Read a Study Record",
  },
  {
    label: "U.S. Food and Drug Administration — Clinical Trial Basics",
    href: "https://www.fda.gov/drugs/news-events-human-drugs/clinical-trial-basics",
  },
  {
    label: "National Institute of Mental Health, National Institutes of Health — Clinical Research Trials and You",
    href: "https://www.nimh.nih.gov/health/publications/clinical-research-trials-and-you-questions-and-answers",
  },
  {
    label: "U.S. Food and Drug Administration — Good Clinical Practice Guidance",
  },
];

// Phases render as their own card grid (not a plain ExplainerSections list)
// so "Phase N" always sits on its own line above the description, rather
// than sharing a row where it can be squeezed and wrap mid-label on narrow
// screens.
const phaseCards = [
  {
    name: "Phase 1",
    body: "Usually focuses on safety. Researchers study possible side effects and determine how the treatment should be given.",
  },
  {
    name: "Phase 2",
    body: "Continues to evaluate safety while looking for early evidence that the treatment may help.",
  },
  {
    name: "Phase 3",
    body: "Tests the treatment in a larger group to confirm its benefits, compare it with another approach, and identify less common risks.",
  },
  {
    name: "Phase 4",
    body: "Takes place after approval and follows how the treatment performs in wider, longer-term use.",
  },
];

const introSections: ExplainerSection[] = [
  {
    heading: "Clinical trials and observational studies",
    blocks: [
      {
        type: "p",
        text: "ClinicalTrials.gov includes both interventional studies and observational studies. They serve different purposes.",
      },
      {
        type: "p",
        text: "**Interventional studies.** In an interventional study, also called a clinical trial, researchers assign participants to receive a treatment, procedure, device, or another intervention. They then measure what happens. The treatment may be compared with standard care, an inactive treatment called a placebo, a sham procedure, or a group that does not receive the experimental treatment.",
      },
      {
        type: "p",
        text: "**Observational studies.** In an observational study, researchers do not assign participants to a new treatment. Instead, they collect information and follow what happens over time. For RP, these may be called natural history studies. They can help researchers understand how a particular form of RP progresses, which tests best measure changes in vision, and how future treatment trials should be designed.",
      },
    ],
  },
];

const restSections: ExplainerSection[] = [
  {
    heading: "What taking part may involve",
    blocks: [
      {
        type: "p",
        text: "Participation begins before anyone receives a study treatment.",
      },
      { type: "p", text: "The process may include:" },
      {
        type: "list",
        items: [
          "An initial phone call or questionnaire",
          "A review of medical and genetic records",
          "Eye exams, imaging, vision tests, or blood tests",
          "A screening visit to confirm whether you meet the study's requirements",
          "A detailed informed-consent discussion",
          "Study visits before and after treatment",
          "Long-term follow-up to monitor safety and changes in vision",
        ],
      },
      {
        type: "p",
        text: "A trial may require more visits, tests, travel, and time than ordinary medical care. Some studies last a few months, while gene or cell therapy trials may follow participants for several years. Participation may provide access to an experimental treatment, but there is no guarantee of a direct benefit.",
      },
    ],
  },
  {
    heading: "Randomization, placebos, and comparison groups",
    blocks: [
      {
        type: "p",
        text: "Researchers often need a comparison group to determine whether a treatment is truly responsible for any changes they observe.",
      },
      {
        type: "p",
        text: "**Randomization** means that participants are assigned to study groups by chance rather than choosing their group.",
      },
      { type: "p", text: "Depending on the trial, the comparison group may receive:" },
      {
        type: "list",
        items: [
          "Standard care",
          "A placebo, which looks like the study treatment but does not contain the active treatment",
          "A sham procedure that copies parts of the treatment process without delivering the experimental therapy",
          "No study treatment during the comparison period",
        ],
      },
      {
        type: "p",
        text: "Not every clinical trial uses a placebo or sham procedure. The study team must explain the design before you decide whether to participate.",
      },
    ],
  },
  {
    heading: "Who can join a trial?",
    blocks: [
      {
        type: "p",
        text: "Every trial has **eligibility criteria**, also called inclusion and exclusion criteria. These rules help protect participants and ensure that researchers can interpret the results accurately.",
      },
      { type: "p", text: "For an RP trial, eligibility may depend on:" },
      {
        type: "list",
        items: [
          "The gene involved",
          "The specific genetic variant",
          "Age",
          "The type and stage of the condition",
          "Current vision and the amount of functioning retina that remains",
          "Previous treatments",
          "Other medical or eye conditions",
          "Whether you can attend the required visits and follow-up appointments",
        ],
      },
      {
        type: "p",
        text: "Meeting a few basic criteria does not mean that you qualify. The study team must review your information and complete any required screening before confirming eligibility.",
      },
    ],
  },
  {
    heading: "What a study's status means",
    blocks: [
      {
        type: "p",
        text: "A trial's status tells you where it is in the enrollment process.",
      },
      {
        type: "list",
        items: [
          "**Not yet recruiting:** The study plans to enroll participants but has not started.",
          "**Recruiting:** The study is currently looking for participants.",
          "**Enrolling by invitation:** The study is enrolling only people selected by the researchers.",
          "**Active, not recruiting:** The study is continuing, but it is no longer accepting new participants.",
          "**Completed:** The study has ended normally. Results may not be available yet.",
          "**Suspended:** Enrollment or study activity has been temporarily stopped.",
          "**Terminated:** The study ended earlier than planned after enrolling at least one participant.",
          "**Withdrawn:** The study ended before any participants were enrolled.",
          "**Unknown:** The study's current status has not been confirmed recently. Do not assume that it is still open.",
        ],
      },
      {
        type: "p",
        text: "**Preclinical research is not a clinical-trial status.** It refers to work conducted in laboratories or animals before a treatment is ready to be studied in people.",
      },
    ],
  },
  {
    heading: "What informed consent means",
    blocks: [
      {
        type: "p",
        text: "Before you join a trial, the study team must explain what the research involves. This process is called **informed consent**.",
      },
      { type: "p", text: "You should receive information about:" },
      {
        type: "list",
        items: [
          "The purpose of the study",
          "What will happen during participation",
          "Known and possible risks",
          "Possible benefits",
          "Other treatment or care options",
          "The study's length and required visits",
          "How your information and samples may be used",
          "Costs, payments, and possible travel support",
          "Who to contact with questions or concerns",
        ],
      },
      {
        type: "p",
        text: "Signing an informed-consent form is not a contract. Participation is voluntary, and you may choose not to join or decide to stop later. Informed consent is an ongoing process, so the study team should tell you about important new information that could affect your decision to continue.",
      },
    ],
  },
  {
    heading: "How participants are protected",
    blocks: [
      {
        type: "p",
        text: "Clinical trials must follow rules intended to protect participants and produce trustworthy results.",
      },
      {
        type: "p",
        text: "In the United States, most trials are reviewed by an **Institutional Review Board**, or IRB. An IRB is an independent group that reviews the study's purpose, design, risks, consent process, and protections for participants.",
      },
      {
        type: "p",
        text: "Study teams must monitor participants for safety, document problems, protect private information, and report certain findings to oversight bodies. These protections reduce risk, but they cannot make an experimental treatment risk-free.",
      },
    ],
  },
  {
    heading: "Questions to ask before joining",
    blocks: [
      { type: "p", text: "Before deciding, ask the study team:" },
      {
        type: "list",
        items: [
          "What is the study trying to find out?",
          "What phase is the trial?",
          "What is already known about the treatment?",
          "What risks or side effects have been reported?",
          "Will everyone receive the experimental treatment?",
          "How are participants assigned to groups?",
          "What exams, procedures, and follow-up visits are required?",
          "How much travel and time will participation require?",
          "Which costs are covered, and is travel support available?",
          "Who will provide medical care if a problem occurs?",
          "What happens if I decide to leave the study?",
          "Will I be told the study's results?",
          "Will I be able to receive the treatment after the trial ends?",
        ],
      },
      {
        type: "p",
        text: "It can help to bring a family member, caregiver, or trusted friend to the conversation and discuss the study with your own eye doctor or genetic counselor.",
      },
    ],
  },
  {
    heading: "A note about experimental treatments",
    blocks: [
      {
        type: "p",
        text: "A study listed on ClinicalTrials.gov has not necessarily shown that its treatment is safe or effective. Some trials are testing a treatment in people for the first time, and some treatments do not succeed.",
      },
      {
        type: "p",
        text: "Before making a decision, review the study with a qualified eye specialist or genetic counselor and speak directly with the study team.",
      },
    ],
  },
];

export default function WhatIsAClinicalTrialPage() {
  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-3xl px-5 py-16">
        <Eyebrow>Understanding research</Eyebrow>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
          What is a{" "}
          <span className="italic font-medium text-gold">clinical trial?</span>
        </h1>
        <div className="mt-6 max-w-2xl space-y-4 text-xl leading-relaxed text-ink/80">
          <p>
            A clinical trial is a research study involving people. It is
            designed to answer specific questions about a treatment, such as
            whether it is safe, whether it helps, and which dose or method
            works best.
          </p>
          <p>
            A clinical trial is not the same as receiving an approved
            treatment. The treatment is still being studied, so it may not
            work, and some risks may not yet be known. Trials are carefully
            designed to produce reliable evidence while protecting the rights
            and safety of participants.
          </p>
        </div>

        <ExplainerSections sections={introSections} />

        <section className="mt-10">
          <h2 className="font-display text-2xl font-medium tracking-tight text-forest">
            The phases of a clinical trial
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-ink/80">
            Clinical trials often move through several phases. Each phase
            answers a different set of questions.
          </p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {phaseCards.map((p) => (
              <li
                key={p.name}
                className="rounded-lg border border-ink/10 bg-white p-5"
              >
                <span className="block whitespace-nowrap font-display text-lg font-bold text-forest">
                  {p.name}
                </span>
                <span className="mt-2 block text-ink/80">{p.body}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-lg leading-relaxed text-ink/80">
            Some trials combine phases, such as Phase 1/2 or Phase 2/3. Not
            every study follows exactly the same path, especially when
            researchers are studying rare diseases, medical devices, or new
            types of gene and cell therapy.
          </p>
        </section>

        <ExplainerSections sections={restSections} />

        <section className="mt-10 rounded-lg bg-forest p-8 text-cream">
          <h2 className="font-display text-2xl font-medium tracking-tight">
            &ldquo;May be relevant&rdquo; does not mean &ldquo;you
            qualify&rdquo;
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-cream/90">
            RP Hope&rsquo;s Clinical Trials Finder helps you identify studies
            that may be worth reviewing based on information such as your
            gene, age, location, and diagnosis.
          </p>
          <p className="mt-3 text-lg leading-relaxed text-cream/90">
            It does not determine whether you qualify, recommend that you
            join, or replace advice from your medical team. Only the study
            team can confirm eligibility and explain the risks, requirements,
            and possible benefits of participating.
          </p>
          <div className="mt-5">
            <CTAButton href="/clinical-trials" variant="primary" arrow>
              Open the Clinical Trials Finder
            </CTAButton>
          </div>
        </section>

        <EducationalDisclaimer />

        <p className="mt-4 text-sm text-ink/55">Last reviewed: July 2026</p>

        <SourcesList sources={sources} />

        <div className="mt-12 flex flex-wrap gap-4">
          <CTAButton href="/what-is-rp" variant="primary" arrow>
            Back to Understanding RP
          </CTAButton>
          <CTAButton href="/future-therapies" variant="secondary" arrow>
            Explore Future Therapies
          </CTAButton>
        </div>
      </div>
    </div>
  );
}
