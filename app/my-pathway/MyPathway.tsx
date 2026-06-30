"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { questions, recommend, type Answers } from "@/lib/pathway";

const roleLabels: Record<string, string> = {
  patient: "person living with RP",
  family: "parent / family member",
  caregiver: "caregiver",
  supporter: "supporter",
  clinician: "researcher / clinician",
  learning: "curious learner",
};

export default function MyPathway() {
  const [step, setStep] = useState(0); // 0..questions.length-1, then "results"
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState<Answers>({ goals: [] });

  const q = questions[step];
  const total = questions.length;

  const currentValue = answers[q?.id as keyof Answers];
  const canContinue =
    q?.optional ||
    (q?.multi
      ? Array.isArray(currentValue) && currentValue.length > 0
      : Boolean(currentValue));

  function select(value: string) {
    setAnswers((prev) => {
      if (q.multi) {
        const arr = new Set(prev.goals || []);
        arr.has(value) ? arr.delete(value) : arr.add(value);
        return { ...prev, goals: Array.from(arr) };
      }
      return { ...prev, [q.id]: value };
    });
  }

  function isSelected(value: string) {
    if (q.multi) return (answers.goals || []).includes(value);
    return currentValue === value;
  }

  function next() {
    if (step < total - 1) setStep((s) => s + 1);
    else setDone(true);
  }
  function back() {
    if (done) setDone(false);
    else if (step > 0) setStep((s) => s - 1);
  }
  function restart() {
    setAnswers({ goals: [] });
    setStep(0);
    setDone(false);
  }

  const results = useMemo(() => (done ? recommend(answers) : []), [done, answers]);

  if (done) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-16">
        <p className="text-sm font-bold uppercase tracking-widest text-forest">
          My RP Pathway
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold text-ink sm:text-5xl">
          Your personalized guide
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-ink/70">
          Built for a{" "}
          <span className="font-semibold text-ink">
            {roleLabels[answers.role || ""] || "visitor"}
          </span>
          . Recommended sections are highlighted — but everything stays available.
        </p>

        {/* Safety / governance note */}
        <div className="mt-6 rounded-xl border border-gold/40 bg-butter/50 px-5 py-4 text-sm text-ink/80">
          <p>
            <span className="font-semibold">AI-assisted curation</span> from RP
            Hope&rsquo;s reviewed research library. This guide is for education and
            navigation only,{" "}
            <span className="font-semibold">not medical advice</span>, diagnosis,
            or treatment recommendations.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {results.map((s) => (
            <Link
              key={s.id}
              href={s.href}
              className={`group flex flex-col rounded-2xl border p-6 shadow-sm transition hover:shadow-md ${
                s.recommended
                  ? "border-forest/30 bg-white ring-1 ring-forest/20"
                  : "border-ink/10 bg-white/70"
              }`}
            >
              <div className="flex items-center justify-between">
                <span aria-hidden="true" className="text-2xl">
                  {s.icon}
                </span>
                {s.recommended && (
                  <span className="rounded-full bg-forest/10 px-3 py-1 text-xs font-bold text-forest">
                    Recommended for you
                  </span>
                )}
              </div>
              <h2 className="mt-4 font-display text-xl font-bold text-ink">
                {s.title}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-ink/70">
                {s.description}
              </p>
              {s.recommended && s.reason && (
                <p className="mt-3 text-xs italic text-forest/80">
                  Because {s.reason}.
                </p>
              )}
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-forest group-hover:underline">
                Go to {s.title} <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>

        {answers.updates === "yes" && (
          <div className="mt-8 rounded-2xl bg-forest px-6 py-6 text-white">
            <h2 className="font-display text-xl font-bold">
              You&rsquo;re set for monthly updates
            </h2>
            <p className="mt-2 text-white/80">
              Add your email to start receiving curated, easy-to-read RP research
              and event news.
            </p>
            <form className="mt-4 flex max-w-md gap-2" onSubmit={(e) => e.preventDefault()}>
              <label htmlFor="pathway-email" className="sr-only">
                Email address
              </label>
              <input
                id="pathway-email"
                type="email"
                placeholder="your@email.com"
                className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder:text-white/50"
              />
              <button
                type="submit"
                className="rounded-lg bg-white px-4 py-2 font-semibold text-forest hover:bg-cream"
              >
                Subscribe
              </button>
            </form>
          </div>
        )}

        <div className="mt-10 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={restart}
            className="rounded-xl border border-ink/30 px-6 py-3 font-bold text-ink hover:bg-ink/5"
          >
            ↺ Start over
          </button>
          <Link
            href="/explore"
            className="rounded-xl bg-ink px-6 py-3 font-bold text-white hover:bg-black"
          >
            Browse everything instead
          </Link>
        </div>
      </div>
    );
  }

  // ---- Quiz ----
  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <p className="text-sm font-bold uppercase tracking-widest text-forest">
        My RP Pathway
      </p>
      <h1 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl">
        Build your guide in 60 seconds
      </h1>
      <p className="mt-3 text-ink/70">
        A few quick questions — no account needed. We&rsquo;ll point you to the
        right parts of RP Hope.
      </p>

      {/* Progress */}
      <div className="mt-8" aria-hidden="true">
        <div className="flex gap-2">
          {questions.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i <= step ? "bg-forest" : "bg-ink/15"
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
          Question {step + 1} of {total}
        </p>

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
                  className={`grid h-6 w-6 place-items-center rounded-full border text-sm ${
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
      </fieldset>

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={back}
          disabled={step === 0}
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
          {step === total - 1 ? "See my pathway" : "Continue"}
        </button>
      </div>
    </div>
  );
}
