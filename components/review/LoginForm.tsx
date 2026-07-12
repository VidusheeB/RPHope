"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabaseBrowser";

// Invite-only login. Primary method is email + password (reviewers set their
// own password from the invite link). Magic-link is offered only as an optional
// fallback — never the sole method, and never a shared password.
export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signInPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    const supabase = getBrowserSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    router.replace("/review");
    router.refresh();
  }

  async function sendMagicLink() {
    if (!email) {
      setStatus("Enter your email first.");
      return;
    }
    setBusy(true);
    setStatus(null);
    const supabase = getBrowserSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/review` },
    });
    setBusy(false);
    setStatus(error ? error.message : "Check your email for a sign-in link.");
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="font-display text-2xl font-medium text-forest">Reviewer sign in</h1>
      <form onSubmit={signInPassword} className="mt-6 space-y-4">
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
        <label className="block text-sm">
          <span className="font-semibold text-ink">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-ink/20 px-3 py-2"
            autoComplete="current-password"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-forest px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm">
        <button onClick={sendMagicLink} disabled={busy} className="text-forest underline">
          Email me a sign-in link
        </button>
        <Link href="/review/reset-password" className="text-forest underline">
          Forgot password?
        </Link>
      </div>

      {status ? (
        <p className="mt-4 rounded bg-forest/5 p-3 text-sm text-ink/80" role="status">
          {status}
        </p>
      ) : null}
      <p className="mt-6 text-xs text-ink/60">
        Reviewer access is invite-only. If you were invited, use the link in your email to set a
        password first.
      </p>
    </div>
  );
}
