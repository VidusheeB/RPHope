"use client";

import { useState } from "react";

const PRESETS = [20, 50, 100, 200, 500, 1000];

type Frequency = "one_time" | "monthly";

export default function DonateForm() {
  const [frequency, setFrequency] = useState<Frequency>("one_time");
  const [amount, setAmount] = useState<number>(20);
  const [custom, setCustom] = useState("");
  const [isOther, setIsOther] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthly = frequency === "monthly";

  // The dollar figure we'll actually send: the custom input when "Other" is
  // selected, otherwise the chosen preset.
  const effectiveAmount = isOther ? Number(custom) : amount;
  const amountValid = Number.isFinite(effectiveAmount) && effectiveAmount >= 1;

  const buttonLabel = amountValid
    ? `Donate $${effectiveAmount.toLocaleString()}${monthly ? "/month" : ""}`
    : "Donate";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!amountValid) {
      setError("Please enter an amount of $1 or more.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: effectiveAmount,
          frequency: monthly ? "monthly" : "one_time",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        setError(data?.error || "We couldn't start checkout. Please try again.");
        setLoading(false);
        return;
      }
      // Hand off to Stripe's hosted, accessible payment page.
      window.location.href = data.url;
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
      <fieldset>
        <legend className="text-xs font-bold uppercase tracking-[0.16em] text-ink/70">
          Frequency
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {([
            ["one_time", "One time"],
            ["monthly", "Monthly"],
          ] as const).map(([value, label]) => {
            const selected = frequency === value;
            return (
              <label
                key={value}
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-md border px-4 py-3 font-semibold ${
                  selected
                    ? "border-forest bg-forest text-white"
                    : "border-ink/25 text-ink"
                }`}
              >
                <input
                  type="radio"
                  name="frequency"
                  className="sr-only"
                  checked={selected}
                  onChange={() => {
                    setFrequency(value);
                    setError(null);
                  }}
                />
                {label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs font-bold uppercase tracking-[0.16em] text-ink/70">
          Amount
        </legend>
        <div className="mt-2 grid grid-cols-3 gap-3">
          {PRESETS.map((value) => {
            const selected = !isOther && amount === value;
            return (
              <label
                key={value}
                className={`flex cursor-pointer items-center justify-center rounded-md border px-4 py-3 font-semibold ${
                  selected
                    ? "border-forest bg-forest text-white"
                    : "border-ink/25 text-ink"
                }`}
              >
                <input
                  type="radio"
                  name="amount"
                  className="sr-only"
                  checked={selected}
                  onChange={() => {
                    setIsOther(false);
                    setAmount(value);
                    setError(null);
                  }}
                />
                ${value.toLocaleString()}
              </label>
            );
          })}
          <label
            className={`col-span-3 flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 font-semibold ${
              isOther ? "border-forest bg-forest/5" : "border-ink/25"
            } text-ink`}
          >
            <input
              type="radio"
              name="amount"
              className="sr-only"
              checked={isOther}
              onChange={() => {
                setIsOther(true);
                setError(null);
              }}
            />
            <span>Other</span>
            <span className="flex items-center gap-1">
              <span aria-hidden="true">$</span>
              <input
                type="number"
                inputMode="decimal"
                min={1}
                step={1}
                aria-label="Custom donation amount in dollars"
                value={custom}
                onFocus={() => {
                  setIsOther(true);
                  setError(null);
                }}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Amount"
                className="w-28 rounded-md border border-ink/25 px-2 py-1 text-ink"
              />
            </span>
          </label>
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-forest px-5 py-4 text-lg font-bold text-white hover:bg-forest-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Redirecting to secure checkout…" : buttonLabel}
      </button>
      <p className="text-xs text-ink/60">
        Payments are processed securely by Stripe. You can pay by card, Apple
        Pay, or Google Pay.
      </p>
    </form>
  );
}
