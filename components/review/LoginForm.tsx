"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabaseBrowser";
import { reviewHref } from "@/lib/reviewer/paths";

// Invite-only login. Primary method is email + password (reviewers set their
// own password from the invite link). Magic-link is offered only as an optional
// fallback — never the sole method, and never a shared password.
//
// WHY THIS DOES MORE THAN CALL signInWithPassword
// -----------------------------------------------
// Supabase auth and portal access are two different gates. A deactivated
// person still has valid credentials, so sign-in SUCCEEDS and then
// requireReviewer() bounces them back here — with no explanation, and they
// loop forever re-entering a password that was never the problem.
//
// So after authenticating we check the profile and, if they are not allowed
// in, sign them straight back out and say exactly why. Someone locked out
// should know whether to fix their password or call an admin.
export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function signInPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    const supabase = getBrowserSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setBusy(false);
      // Deliberately NOT distinguishing "no such email" from "wrong password".
      // Saying which would let anyone test whether a given person has an RP
      // Hope account, and the fix is the same either way: check both.
      const banned = /banned|blocked/i.test(error.message);
      setProblem(
        banned
          ? { kind: "error", text: "This account has been removed and can no longer sign in. If you think that's wrong, contact an RP Hope administrator." }
          : { kind: "error", text: "That email and password don't match. Check both and try again, or use \u201cForgot password\u201d below." }
      );
      return;
    }

    // Authenticated — but authentication is not access.
    //
    // FILTER BY user_id EXPLICITLY. Relying on RLS to narrow this to "my row"
    // is wrong: rp_select_own_or_admin lets an ADMIN read every profile, so an
    // unfiltered maybeSingle() returns several rows for them and errors —
    // which read as "this account isn't set up" and locked every admin out
    // while reviewers signed in fine.
    const { data: signedIn } = await supabase.auth.getUser();
    const userId = signedIn.user?.id;

    const { data: profile, error: profileError } = userId
      ? await supabase.from("reviewer_profiles").select("active").eq("user_id", userId).maybeSingle()
      : { data: null, error: null };
    setBusy(false);

    // A failed LOOKUP is not the same as a missing profile. Conflating them is
    // what turned a query bug into a confident, wrong message about the
    // account itself.
    if (profileError) {
      await supabase.auth.signOut();
      setProblem({
        kind: "error",
        text: "We couldn't check your account just now. Please try again in a moment.",
      });
      return;
    }

    if (!profile) {
      await supabase.auth.signOut();
      setProblem({
        kind: "error",
        text: "This account isn't set up for the RP Hope Team Portal. Ask an administrator to invite you.",
      });
      return;
    }
    if (!profile.active) {
      // Sign out rather than leaving a half-session behind: otherwise the
      // cookie exists, every page redirects here, and it looks like the login
      // button is broken.
      await supabase.auth.signOut();
      setProblem({
        kind: "error",
        text: "Your account has been deactivated. Please ask an RP Hope administrator to reactivate it, then sign in again.",
      });
      return;
    }

    router.replace(reviewHref(""));
    router.refresh();
  }

  async function sendMagicLink() {
    if (!email) {
      setProblem({ kind: "error", text: "Enter your email first." });
      return;
    }
    setBusy(true);
    setProblem(null);
    const supabase = getBrowserSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}${reviewHref("")}` },
    });
    setBusy(false);
    setProblem(
      error
        ? { kind: "error", text: error.message }
        : { kind: "info", text: "Check your email for a sign-in link." }
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="font-display text-2xl font-medium text-forest">Team member sign in</h1>
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
        <Link href={reviewHref("/reset-password")} className="text-forest underline">
          Forgot password?
        </Link>
      </div>

      {problem ? (
        <p
          // role=alert so a screen reader announces a failed sign-in
          // immediately rather than only on the next focus move.
          role={problem.kind === "error" ? "alert" : "status"}
          className={`mt-4 rounded-md p-3 text-sm ${
            problem.kind === "error"
              ? "border border-red-200 bg-red-50 text-red-900"
              : "border border-ink/10 bg-forest/5 text-ink/80"
          }`}
        >
          {problem.text}
        </p>
      ) : null}
      <p className="mt-6 text-xs text-ink/60">
        Access is invite-only. If you were invited, use the link in your email to set a password
        first.
      </p>
    </div>
  );
}
