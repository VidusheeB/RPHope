"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabaseBrowser";
import { reviewHref } from "@/lib/reviewer/paths";

// Used for BOTH the invite flow ("set your password") and the reset flow
// ("choose a new password").
//
// HOW SOMEONE GETS HERE
// ---------------------
// The emailed link is a magic link: clicking it verifies the token with
// Supabase, which SIGNS THEM IN and redirects here with that session. So by
// the time this form renders they are already authenticated, and updateUser()
// simply attaches a password to the account. No password is ever emailed, and
// no temporary one exists.
//
// Supabase consumes the token on verification, so the link is single-use by
// construction — a second click cannot establish a session.
//
// WHY THE SESSION IS CHECKED UP FRONT
// -----------------------------------
// This form previously assumed a session existed. When one didn't — expired
// link, already used, opened in a different browser — the only signal was a
// raw "Auth session missing" after the person had already chosen and typed a
// password twice. Invitations can be a week old by design, so that is a path
// people will land on, and it needs to say what happened and what to do.

type SessionState = "checking" | "ready" | "missing";

export default function SetPasswordForm({ heading }: { heading: string }) {
  const router = useRouter();
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = getBrowserSupabase();
      // The client parses the token out of the URL asynchronously on load, so
      // a bare getSession() can race it. onAuthStateChange fires once that
      // has happened; the getSession() below covers the already-settled case.
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!cancelled && session) setSessionState("ready");
      });
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) setSessionState("ready");
      else {
        // Give the URL-parsing a moment before declaring the link dead —
        // calling it expired when it is merely slow would be worse than
        // waiting.
        setTimeout(() => {
          if (!cancelled) {
            void supabase.auth.getSession().then(({ data: d }) => {
              if (!cancelled) setSessionState(d.session ? "ready" : "missing");
            });
          }
        }, 1200);
      }
      return () => sub.subscription.unsubscribe();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = getBrowserSupabase();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(
        /session|jwt|token/i.test(updateError.message)
          ? "This link has expired or has already been used. Ask an RP Hope administrator to send you a new invitation."
          : updateError.message
      );
      return;
    }
    // Already signed in from the magic link, so go straight into the portal
    // rather than bouncing to a login form to retype what was just chosen.
    router.replace(reviewHref(""));
    router.refresh();
  }

  if (sessionState === "checking") {
    return (
      <div className="mx-auto max-w-sm">
        <p role="status" className="text-sm text-ink/60">
          Checking your invitation…
        </p>
      </div>
    );
  }

  if (sessionState === "missing") {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="font-display text-2xl font-medium text-forest">{heading}</h1>
        <p role="alert" className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This link has expired or has already been used. Invitation links work once, and only for a
          limited time.
        </p>
        <p className="mt-3 text-sm text-ink/70">
          Ask an RP Hope administrator to send you a new invitation. If you already have a password,
          you can{" "}
          <Link href={reviewHref("/login")} className="font-semibold text-forest underline">
            sign in
          </Link>{" "}
          instead.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="font-display text-2xl font-medium text-forest">{heading}</h1>
      <p className="mt-2 text-sm text-ink/60">
        Choose a password for your RP Hope Team Portal account.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm">
          <span className="font-semibold text-ink">New password</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="pw-rule"
            className="mt-1 h-10 w-full rounded-md border border-ink/15 px-3 outline-none focus-visible:ring-2 focus-visible:ring-forest"
            autoComplete="new-password"
          />
          <span id="pw-rule" className="mt-1 block text-xs text-ink/55">
            At least 8 characters.
          </span>
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-ink">Confirm password</span>
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-ink/15 px-3 outline-none focus-visible:ring-2 focus-visible:ring-forest"
            autoComplete="new-password"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="h-10 w-full rounded-md bg-forest px-4 font-semibold text-white hover:bg-forest/90 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save password"}
        </button>
      </form>
      {error ? (
        <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
