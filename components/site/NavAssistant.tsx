"use client";

import { useState } from "react";
import Link from "next/link";

type Suggestion = { label: string; href: string };
type NavResult = {
  reply: string;
  confidence: "high" | "medium" | "none";
  suggestions: Suggestion[];
};

const examples = [
  "I was just diagnosed — where do I start?",
  "the one where a virus fixes the gene",
  "trials I could join",
];

export default function NavAssistant() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<NavResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask(q: string) {
    const text = q.trim();
    if (!text) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/navigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text }),
      });
      setResult(await res.json());
    } catch {
      setResult({
        reply: "Something went wrong — try the search below instead.",
        confidence: "none",
        suggestions: [],
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="nav-assistant-heading">
      <h2
        id="nav-assistant-heading"
        className="flex items-center gap-2 font-display text-xl font-bold text-forest"
      >
        <span aria-hidden="true">🧭</span> Tell us what you&rsquo;re looking for
      </h2>
      <p className="mt-1 text-sm text-ink/70">
        Describe it in your own words and we&rsquo;ll point you to the right place.
      </p>

      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          ask(query);
        }}
      >
        <label htmlFor="nav-assistant-input" className="sr-only">
          What are you looking for?
        </label>
        <input
          id="nav-assistant-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. I have trouble seeing at night"
          className="flex-1 rounded-xl border border-ink/15 bg-white px-4 py-3 text-base outline-none focus:border-forest"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-forest px-6 py-3 font-bold text-white hover:bg-forest-dark disabled:opacity-50"
        >
          {loading ? "Thinking…" : "Find it"}
        </button>
      </form>

      {!result && !loading && (
        <div className="mt-3 flex flex-wrap gap-2">
          {examples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setQuery(ex);
                ask(ex);
              }}
              className="rounded-full border border-forest/30 px-3 py-1 text-xs text-forest hover:bg-forest/10"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {result && (
        <div aria-live="polite" className="mt-5">
          <p className="text-ink/90">{result.reply}</p>
          {result.suggestions.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {result.suggestions.map((s) => {
                const external = /^https?:\/\//.test(s.href);
                const cls =
                  "inline-flex items-center gap-1 rounded-xl border border-forest/30 bg-white px-4 py-2 text-sm font-semibold text-forest hover:border-forest hover:bg-forest/5";
                return (
                  <li key={s.href}>
                    {external ? (
                      <a
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cls}
                      >
                        <span aria-hidden="true">📄</span> {s.label}{" "}
                        <span aria-hidden="true">↗</span>
                      </a>
                    ) : (
                      <Link href={s.href} className={cls}>
                        {s.label} <span aria-hidden="true">→</span>
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink/50">
            For education and navigation only — not medical advice.
          </p>
        </div>
      )}
    </section>
  );
}
