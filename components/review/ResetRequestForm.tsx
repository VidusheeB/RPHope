"use client";

import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabaseBrowser";

export default function ResetRequestForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    const supabase = getBrowserSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/review/set-password`,
    });
    setBusy(false);
    setStatus(
      error ? error.message : "If that email has an account, a reset link is on its way."
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="font-display text-2xl font-medium text-forest">Reset your password</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm">
          <span className="font-semibold text-ink">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-ink/20 px-3 py-2"
            autoComplete="username"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-forest px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send reset link"}
        </button>
      </form>
      {status ? (
        <p className="mt-4 rounded bg-forest/5 p-3 text-sm text-ink/80" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
