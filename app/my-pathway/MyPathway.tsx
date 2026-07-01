"use client";

// My RP Pathway — a short quiz that builds a guided JOURNEY through the site
// (not a recommendation grid). See lib/pathway.ts for the deterministic logic.

import { useEffect, useMemo, useState } from "react";
import { questions, buildPathway, type PathwayAnswers } from "@/lib/pathway";
import { geneGrid } from "@/lib/geneGrid";
import PathwayJourney from "@/components/site/PathwayJourney";

// Temporarily preserve the journey for the current tab, so visiting a stop and
// coming back doesn't wipe the quiz. sessionStorage is per-tab and clears when
// the tab closes — used here only as a graceful enhancement (no medical data).
const STORAGE_KEY = "rphope_pathway";

export default function MyPathway() {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState<PathwayAnswers>({});
  const [mounted, setMounted] = useState(false);

  // Restore any in-session journey once, after hydration.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          answers?: PathwayAnswers;
          done?: boolean;
          step?: number;
        };
        if (saved.answers) setAnswers(saved.answers);
        if (saved.done) setDone(true);
        if (typeof saved.step === "number") setStep(saved.step);
      }
    } catch {
      /* storage unavailable — quiz still works, just no restore */
    }
    setMounted(true);
  }, []);

  // Persist on change (skip until after the restore pass, so we don't clobber it).
  useEffect(() => {
    if (!mounted) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, done, step }));
    } catch {
      /* ignore */
    }
  }, [answers, done, step, mounted]);

  // Questions currently applicable (Q4 gene selector only shows if gene = yes).
  const visible = useMemo(
    () => questions.filter((q) => !q.showIf || q.showIf(answers)),
    [answers],
  );
  const safeStep = Math.min(step, visible.length - 1);
  const q = visible[safeStep];
  const total = visible.length;

  const value = answers[q.id];
  const canContinue = q.geneSelector
    ? true
    : q.multi
      ? Array.isArray(value) && value.length > 0
      : Boolean(value);

  const isSelected = (v: string) =>
    q.multi ? Array.isArray(value) && value.includes(v) : value === v;

  function select(v: string) {
    if (q.multi) {
      setAnswers((prev) => {
        const set = new Set((prev[q.id] as string[] | undefined) ?? []);
        set.has(v) ? set.delete(v) : set.add(v);
        return { ...prev, [q.id]: Array.from(set) };
      });
      return;
    }
    setAnswers((prev) => ({ ...prev, [q.id]: v }));
  }

  function next() {
    if (safeStep < total - 1) setStep(safeStep + 1);
    else setDone(true);
  }
  function back() {
    if (done) setDone(false);
    else if (safeStep > 0) setStep(safeStep - 1);
  }
  function restart() {
    setAnswers({});
    setStep(0);
    setDone(false);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  const result = useMemo(() => (done ? buildPathway(answers) : null), [done, answers]);

  if (done && result) {
    return <PathwayJourney result={result} onRestart={restart} />;
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <p className="text-sm font-bold uppercase tracking-widest text-forest">
        My RP Pathway
      </p>
      <h1 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl">
        Build your guided journey
      </h1>
      <p className="mt-3 text-ink/70">
        Answer a few questions and we&rsquo;ll build a step-by-step path through RP
        Hope based on what you&rsquo;re looking for. This is a navigation tool, not
        medical advice.
      </p>

      {/* Progress */}
      <div className="mt-8" aria-hidden="true">
        <div className="flex gap-2">
          {visible.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i <= safeStep ? "bg-forest" : "bg-ink/15"
              }`}
            />
          ))}
        </div>
      </div>

      <fieldset className="mt-8">
        <legend className="font-display text-2xl font-bold text-ink">
          {q.prompt}
        </legend>
        {q.helper && <p className="mt-1 text-sm text-ink/60">{q.helper}</p>}
        <p className="sr-only">
          Question {safeStep + 1} of {total}
        </p>

        {q.geneSelector ? (
          <div className="mt-5">
            <label htmlFor="pathway-gene" className="sr-only">
              Gene name
            </label>
            <input
              id="pathway-gene"
              type="text"
              list="pathway-gene-list"
              value={answers.selectedGene || ""}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, selectedGene: e.target.value }))
              }
              placeholder="e.g. RPGR, USH2A, PDE6B"
              autoComplete="off"
              className="w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-lg text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/30"
            />
            <datalist id="pathway-gene-list">
              {geneGrid.map((g) => (
                <option key={g.slug} value={g.display} />
              ))}
            </datalist>
            <p className="mt-2 text-sm text-ink/55">
              If we have a page for that gene, your journey will start there. If not,
              we&rsquo;ll start you in the full gene library — you can also skip this.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-3">
            {q.options.map((opt) => {
              const selected = isSelected(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => select(opt.value)}
                  aria-pressed={selected}
                  className={`flex items-center justify-between rounded-xl border px-5 py-4 text-left text-lg transition ${
                    selected
                      ? "border-forest bg-forest/5 font-semibold text-forest"
                      : "border-ink/15 bg-white text-ink hover:border-forest/40"
                  }`}
                >
                  {opt.label}
                  <span
                    aria-hidden="true"
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-sm ${
                      selected
                        ? "border-forest bg-forest text-white"
                        : "border-ink/25 text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </fieldset>

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={back}
          disabled={safeStep === 0}
          className="rounded-xl px-5 py-3 font-semibold text-ink/70 enabled:hover:bg-ink/5 disabled:opacity-40"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={next}
          disabled={!canContinue}
          className="rounded-xl bg-forest px-7 py-3 font-bold text-white enabled:hover:bg-forest-dark disabled:opacity-40"
        >
          {safeStep === total - 1 ? "See my journey" : "Continue"}
        </button>
      </div>
    </div>
  );
}
