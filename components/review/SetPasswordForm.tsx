"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabaseBrowser";

// Used for BOTH the invite flow ("set your password") and the reset flow
// ("choose a new password"). The user arrives with an active session created by
// the Supabase invite/recovery link; updateUser sets their own password. No
// shared or temporary password is ever issued.
export default function SetPasswordForm({ heading }: { heading: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setStatus("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setStatus("Passwords do not match.");
      return;
    }
    setBusy(true);
    setStatus(null);
    const supabase = getBrowserSupabase();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    router.replace("/review");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="font-display text-2xl font-medium text-forest">{heading}</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm">
          <span className="font-semibold text-ink">New password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-ink/20 px-3 py-2"
            autoComplete="new-password"
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-ink">Confirm password</span>
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full rounded border border-ink/20 px-3 py-2"
            autoComplete="new-password"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-forest px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save password"}
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
