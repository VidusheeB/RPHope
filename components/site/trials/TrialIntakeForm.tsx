"use client";

// Guided intake for the Clinical Trials Finder. Progressive disclosure: one
// question per screen, branching on gene knowledge, with an inline "did you mean"
// confirmation driven by deterministic normalization (no AI round-trip).

import { useMemo, useState } from "react";
import type { TrialFinderIntake } from "@/lib/trials/types";
import { normalizeGene, type GeneNormalization } from "@/lib/trials/normalize";
import { geneGrid } from "@/lib/geneGrid";
import {
  COUNTRIES,
  SEARCH_FOR,
  CONDITIONS,
  GENE_STATUS,
  AGE_GROUPS,
  TRAVEL_SCOPE,
  TRAVEL_RADIUS,
  OPPORTUNITY_TYPE,
  RECRUITING,
  HAS_REPORT,
  EYE_EXAM,
  USER_GOAL,
  SUMMARY_PREFERENCE,
  type IntakeOption,
} from "@/lib/trials/intakeOptions";

type StepId =
  | "search_for"
  | "condition"
  | "gene_status"
  | "gene_input"
  | "gene_confirm"
  | "age_group"
  | "location"
  | "travel"
  | "opportunity"
  | "recruiting"
  | "has_report"
  | "eye_exam"
  | "goal"
  | "summary";

const ORDER: StepId[] = [
  "search_for",
  "condition",
  "gene_status",
  "gene_input",
  "gene_confirm",
  "age_group",
  "location",
  "travel",
  "opportunity",
  "recruiting",
  "has_report",
  "eye_exam",
  "goal",
  "summary",
];

// All UI-collected fields (a superset of TrialFinderIntake, plus form-only ones).
type FormState = {
  search_for: string;
  conditionChoice: string;
  conditionOther: string;
  gene_status: string;
  rawGene: string;
  normalizedGene?: string;
  geneResolved: boolean; // confirm step answered
  age_group: string;
  country: string;
  city: string;
  postal_code: string;
  noLocation: boolean;
  travel_scope: string;
  travel_radius_km: string;
  opportunity: string;
  recruiting: string;
  has_report: string;
  eye_exam: string;
  goal: string;
  summary: string;
};

const initialForm: FormState = {
  search_for: "",
  conditionChoice: "",
  conditionOther: "",
  gene_status: "",
  rawGene: "",
  normalizedGene: undefined,
  geneResolved: false,
  age_group: "",
  country: "",
  city: "",
  postal_code: "",
  noLocation: false,
  travel_scope: "",
  travel_radius_km: "",
  opportunity: "",
  recruiting: "",
  has_report: "",
  eye_exam: "",
  goal: "",
  summary: "",
};

function OptionButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex items-center justify-between rounded-xl border px-5 py-4 text-left text-lg transition ${
        selected
          ? "border-forest bg-forest/5 font-semibold text-forest"
          : "border-ink/15 bg-white text-ink hover:border-forest/40"
      }`}
    >
      {label}
      <span
        aria-hidden="true"
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-sm ${
          selected ? "border-forest bg-forest text-white" : "border-ink/25 text-transparent"
        }`}
      >
        ✓
      </span>
    </button>
  );
}

export default function TrialIntakeForm({
  onSubmit,
}: {
  onSubmit: (intake: TrialFinderIntake) => void;
}) {
  const [step, setStep] = useState<StepId>("search_for");
  const [history, setHistory] = useState<StepId[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const geneNorm: GeneNormalization | null = useMemo(
    () => (form.rawGene.trim() ? normalizeGene(form.rawGene) : null),
    [form.rawGene],
  );

  // Does the gene input need a confirmation screen?
  const needsGeneConfirm =
    form.gene_status === "known" &&
    !!geneNorm &&
    (geneNorm.status === "corrected" || geneNorm.status === "ambiguous");

  function nextStep(current: StepId): StepId | "submit" {
    switch (current) {
      case "search_for":
        return "condition";
      case "condition":
        return "gene_status";
      case "gene_status":
        return form.gene_status === "known" ? "gene_input" : "age_group";
      case "gene_input":
        return needsGeneConfirm ? "gene_confirm" : "age_group";
      case "gene_confirm":
        return "age_group";
      case "age_group":
        return "location";
      case "location":
        return "travel";
      case "travel":
        return "opportunity";
      case "opportunity":
        return "recruiting";
      case "recruiting":
        return "has_report";
      case "has_report":
        return "eye_exam";
      case "eye_exam":
        return "goal";
      case "goal":
        return "summary";
      case "summary":
        return "submit";
    }
  }

  function buildIntake(): TrialFinderIntake {
    const condition_input =
      form.conditionOther.trim() ||
      (form.conditionChoice === "__not_sure__" ? "" : form.conditionChoice);
    const geneKnown = form.gene_status === "known" && !!form.normalizedGene;
    return {
      search_for: form.search_for,
      condition_input,
      gene_status: form.gene_status as TrialFinderIntake["gene_status"],
      raw_gene_input: form.gene_status === "known" ? form.rawGene.trim() : undefined,
      normalized_gene: geneKnown ? form.normalizedGene : undefined,
      gene_confidence: geneKnown ? geneNorm?.confidence : undefined,
      age_group: (form.age_group || "prefer_not") as TrialFinderIntake["age_group"],
      country: form.noLocation ? "" : form.country,
      city: form.city.trim() || undefined,
      postal_code: form.postal_code.trim() || undefined,
      location_precision: form.noLocation
        ? "none"
        : form.postal_code.trim()
          ? "postal_code"
          : form.city.trim()
            ? "city"
            : "country",
      travel_scope: form.travel_scope as TrialFinderIntake["travel_scope"],
      travel_radius_km:
        form.travel_scope === "near_me" && form.travel_radius_km
          ? (Number(form.travel_radius_km) as TrialFinderIntake["travel_radius_km"])
          : undefined,
      opportunity_type_preference:
        form.opportunity as TrialFinderIntake["opportunity_type_preference"],
      recruiting_preference:
        form.recruiting as TrialFinderIntake["recruiting_preference"],
      has_genetic_report:
        (form.has_report || undefined) as TrialFinderIntake["has_genetic_report"],
      recent_eye_exam_status:
        (form.eye_exam || undefined) as TrialFinderIntake["recent_eye_exam_status"],
      user_goal: form.goal || undefined,
      summary_preference: form.summary || undefined,
    };
  }

  function goNext() {
    const n = nextStep(step);
    if (n === "submit") {
      onSubmit(buildIntake());
      return;
    }
    setHistory((h) => [...h, step]);
    setStep(n);
  }

  function goBack() {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setStep(prev);
      return h.slice(0, -1);
    });
  }

  const showConditionOther =
    form.conditionChoice === "__not_sure__" ||
    form.conditionChoice === "inherited retinal disease";

  // Per-step "can continue" gate.
  function canContinue(): boolean {
    switch (step) {
      case "search_for":
        return !!form.search_for;
      case "condition":
        return !!form.conditionChoice;
      case "gene_status":
        return !!form.gene_status;
      case "gene_input":
        return form.rawGene.trim().length > 0;
      case "gene_confirm":
        return form.geneResolved;
      case "age_group":
        return !!form.age_group;
      case "location":
        return form.noLocation || !!form.country;
      case "travel":
        return (
          !!form.travel_scope &&
          (form.travel_scope !== "near_me" || !!form.travel_radius_km)
        );
      case "opportunity":
        return !!form.opportunity;
      case "recruiting":
        return !!form.recruiting;
      case "has_report":
        return !!form.has_report;
      case "eye_exam":
        return !!form.eye_exam;
      case "goal":
        return !!form.goal;
      case "summary":
        return !!form.summary;
    }
  }

  // Progress: position of current step within the (dynamically) reachable path.
  const stepNumber = history.length + 1;
  const approxTotal = form.gene_status === "known" ? ORDER.length : ORDER.length - 2;

  return (
    <div className="mx-auto max-w-2xl px-5 py-14">
      <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">
        Find clinical trial matches
      </h1>
      <p className="mt-3 text-ink/70">
        Answer a few questions about diagnosis, gene status, location, and research
        goals. We&rsquo;ll show you the clinical trials that match your needs best.
      </p>

      {/* Progress */}
      <div className="mt-7" aria-hidden="true">
        <div className="flex gap-1.5">
          {Array.from({ length: approxTotal }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i < stepNumber ? "bg-forest" : "bg-ink/15"
              }`}
            />
          ))}
        </div>
      </div>

      <fieldset className="mt-8">{renderStep()}</fieldset>

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={history.length === 0}
          className="rounded-xl px-5 py-3 font-semibold text-ink/70 enabled:hover:bg-ink/5 disabled:opacity-40"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={!canContinue()}
          className="rounded-xl bg-forest px-7 py-3 font-bold text-white enabled:hover:bg-forest-dark disabled:opacity-40"
        >
          {step === "summary" ? "See research to review" : "Continue"}
        </button>
      </div>
    </div>
  );

  function Legend({ text, helper }: { text: string; helper?: string }) {
    return (
      <>
        <legend className="font-display text-2xl font-bold text-ink">{text}</legend>
        {helper && <p className="mt-1 text-sm text-ink/60">{helper}</p>}
        <p className="sr-only">
          Question {stepNumber} of about {approxTotal}
        </p>
      </>
    );
  }

  function SingleChoice({
    options,
    value,
    onPick,
  }: {
    options: IntakeOption[];
    value: string;
    onPick: (v: string) => void;
  }) {
    return (
      <div className="mt-5 grid gap-3">
        {options.map((o) => (
          <OptionButton
            key={o.value}
            label={o.label}
            selected={value === o.value}
            onClick={() => onPick(o.value)}
          />
        ))}
      </div>
    );
  }

  function renderStep() {
    switch (step) {
      case "search_for":
        return (
          <>
            <Legend text="Who is this search for?" />
            <SingleChoice
              options={SEARCH_FOR}
              value={form.search_for}
              onPick={(v) => set({ search_for: v })}
            />
          </>
        );

      case "condition":
        return (
          <>
            <Legend text="What diagnosis or condition should we search around?" />
            <SingleChoice
              options={CONDITIONS}
              value={form.conditionChoice}
              onPick={(v) => set({ conditionChoice: v })}
            />
            {showConditionOther && (
              <div className="mt-4">
                <label htmlFor="condition-other" className="block text-sm font-semibold text-ink">
                  Tell us what diagnosis, phrase, or condition name you&rsquo;ve been given
                </label>
                <input
                  id="condition-other"
                  type="text"
                  value={form.conditionOther}
                  onChange={(e) => set({ conditionOther: e.target.value })}
                  placeholder="e.g. rod-cone dystrophy"
                  className="mt-2 w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-lg text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/30"
                />
                <p className="mt-1 text-sm text-ink/55">
                  Optional — we&rsquo;ll broaden to inherited retinal disease if it&rsquo;s unclear.
                </p>
              </div>
            )}
          </>
        );

      case "gene_status":
        return (
          <>
            <Legend text="Do you know the gene linked to the diagnosis?" />
            <SingleChoice
              options={GENE_STATUS}
              value={form.gene_status}
              onPick={(v) =>
                set({ gene_status: v, geneResolved: false, normalizedGene: undefined })
              }
            />
          </>
        );

      case "gene_input":
        return (
          <>
            <Legend
              text="What gene was listed on the report?"
              helper="Type it — we'll check it against RP Hope's gene list and confirm with you."
            />
            <div className="mt-5">
              <label htmlFor="gene-input" className="sr-only">
                Gene name
              </label>
              <input
                id="gene-input"
                type="text"
                list="rp-gene-list"
                value={form.rawGene}
                onChange={(e) =>
                  set({ rawGene: e.target.value, normalizedGene: undefined, geneResolved: false })
                }
                placeholder="e.g. RPGR, USH2A, PDE6B"
                autoComplete="off"
                className="w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-lg text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/30"
              />
              <datalist id="rp-gene-list">
                {geneGrid.map((g) => (
                  <option key={g.slug} value={g.display} />
                ))}
              </datalist>
              {geneNorm && geneNorm.status === "exact" && (
                <p className="mt-2 text-sm font-semibold text-forest">
                  ✓ {geneNorm.normalized} is in RP Hope&rsquo;s gene library.
                </p>
              )}
              {geneNorm && geneNorm.status === "none" && (
                <p className="mt-2 text-sm text-ink/60">
                  We don&rsquo;t recognize that as one of RP Hope&rsquo;s listed genes. You
                  can continue — we&rsquo;ll show broader RP/IRD options instead.
                </p>
              )}
            </div>
          </>
        );

      case "gene_confirm": {
        if (!geneNorm) return null;
        if (geneNorm.status === "corrected") {
          return (
            <>
              <Legend text={`You entered "${geneNorm.raw}." Did you mean ${geneNorm.normalized}?`} />
              <div className="mt-5 grid gap-3">
                <OptionButton
                  label={`Yes, use ${geneNorm.normalized}`}
                  selected={form.geneResolved && form.normalizedGene === geneNorm.normalized}
                  onClick={() => set({ normalizedGene: geneNorm.normalized, geneResolved: true })}
                />
                <OptionButton
                  label="No, I'll edit it"
                  selected={false}
                  onClick={goBack}
                />
                <OptionButton
                  label="I'm not sure"
                  selected={form.geneResolved && !form.normalizedGene}
                  onClick={() => set({ normalizedGene: undefined, geneResolved: true })}
                />
              </div>
              {form.geneResolved && !form.normalizedGene && (
                <p className="mt-3 text-sm text-ink/60">
                  No problem — we&rsquo;ll show broader RP/IRD studies you can review.
                </p>
              )}
            </>
          );
        }
        // ambiguous
        return (
          <>
            <Legend text="Did you mean one of these?" helper={`You entered "${geneNorm.raw}."`} />
            <div className="mt-5 grid gap-3">
              {geneNorm.candidates.map((c) => (
                <OptionButton
                  key={c}
                  label={c}
                  selected={form.geneResolved && form.normalizedGene === c}
                  onClick={() => set({ normalizedGene: c, geneResolved: true })}
                />
              ))}
              <OptionButton
                label="None of these / I'm not sure"
                selected={form.geneResolved && !form.normalizedGene}
                onClick={() => set({ normalizedGene: undefined, geneResolved: true })}
              />
            </div>
          </>
        );
      }

      case "age_group":
        return (
          <>
            <Legend
              text="What age group is the potential participant in?"
              helper="Used for broad matching only — we never ask for a date of birth."
            />
            <SingleChoice
              options={AGE_GROUPS}
              value={form.age_group}
              onPick={(v) => set({ age_group: v })}
            />
          </>
        );

      case "location":
        return (
          <>
            <Legend
              text="Where should we search?"
              helper="RP Hope has a global audience — pick any country."
            />
            <div className="mt-5 grid gap-4">
              <div>
                <label htmlFor="country" className="block text-sm font-semibold text-ink">
                  Country
                </label>
                <select
                  id="country"
                  value={form.country}
                  disabled={form.noLocation}
                  onChange={(e) => set({ country: e.target.value })}
                  className="mt-2 w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-lg text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/30 disabled:opacity-50"
                >
                  <option value="">Select a country…</option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c === "Other" ? "" : c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="city" className="block text-sm font-semibold text-ink">
                  City or postal code <span className="font-normal text-ink/55">(optional)</span>
                </label>
                <input
                  id="city"
                  type="text"
                  value={form.city}
                  disabled={form.noLocation}
                  onChange={(e) => set({ city: e.target.value })}
                  placeholder="e.g. Boston or 02114"
                  className="mt-2 w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-lg text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/30 disabled:opacity-50"
                />
              </div>
              <label className="flex items-center gap-3 rounded-xl border border-ink/15 bg-white px-4 py-3 text-ink">
                <input
                  type="checkbox"
                  checked={form.noLocation}
                  onChange={(e) =>
                    set({ noLocation: e.target.checked, country: "", city: "", postal_code: "" })
                  }
                  className="h-5 w-5 rounded border-ink/30 text-forest focus:ring-forest"
                />
                I don&rsquo;t want to provide a specific location
              </label>
            </div>
          </>
        );

      case "travel":
        return (
          <>
            <Legend text="How far could the participant reasonably travel for in-person study visits?" />
            <SingleChoice
              options={TRAVEL_SCOPE}
              value={form.travel_scope}
              onPick={(v) =>
                set({ travel_scope: v, travel_radius_km: v === "near_me" ? form.travel_radius_km : "" })
              }
            />
            {form.travel_scope === "near_me" && (
              <div className="mt-5 rounded-xl border border-forest/20 bg-mint/40 p-4">
                <p className="font-semibold text-ink">What distance feels reasonable?</p>
                {form.noLocation && (
                  <p className="mt-1 text-sm text-ink/60">
                    Tip: &ldquo;Near me&rdquo; works best if you add a city or postal code — but
                    we&rsquo;ll still rank closer studies first where we can.
                  </p>
                )}
                <div className="mt-3 grid gap-3">
                  {TRAVEL_RADIUS.map((o) => (
                    <OptionButton
                      key={o.value}
                      label={o.label}
                      selected={form.travel_radius_km === o.value}
                      onClick={() => set({ travel_radius_km: o.value })}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        );

      case "opportunity":
        return (
          <>
            <Legend
              text="What kind of research opportunity are you open to?"
              helper="Registries and observational studies can be especially useful if the gene isn't known yet."
            />
            <SingleChoice
              options={OPPORTUNITY_TYPE}
              value={form.opportunity}
              onPick={(v) => set({ opportunity: v })}
            />
          </>
        );

      case "recruiting":
        return (
          <>
            <Legend text="Should we focus on studies that are currently accepting participants?" />
            <SingleChoice
              options={RECRUITING}
              value={form.recruiting}
              onPick={(v) => set({ recruiting: v })}
            />
          </>
        );

      case "has_report":
        return (
          <>
            <Legend
              text="Does the participant have a genetic test report?"
              helper="Used to explain what to prepare — not for eligibility."
            />
            <SingleChoice
              options={HAS_REPORT}
              value={form.has_report}
              onPick={(v) => set({ has_report: v })}
            />
          </>
        );

      case "eye_exam":
        return (
          <>
            <Legend text="Has the participant had a recent eye exam or retinal imaging?" />
            <SingleChoice
              options={EYE_EXAM}
              value={form.eye_exam}
              onPick={(v) => set({ eye_exam: v })}
            />
          </>
        );

      case "goal":
        return (
          <>
            <Legend text="What is your main goal right now?" />
            <SingleChoice
              options={USER_GOAL}
              value={form.goal}
              onPick={(v) => set({ goal: v })}
            />
          </>
        );

      case "summary":
        return (
          <>
            <Legend text="What kind of summary would be most helpful?" />
            <SingleChoice
              options={SUMMARY_PREFERENCE}
              value={form.summary}
              onPick={(v) => set({ summary: v })}
            />
          </>
        );
    }
  }
}
