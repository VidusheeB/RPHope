"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabaseBrowser";
import { reviewHref } from "@/lib/reviewer/paths";
import { requestNewInvitationAction, markActivatedAction } from "@/app/review/set-password/actions";

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
// WHY THE TOKEN IS CONSUMED EXPLICITLY
// ------------------------------------
// Supabase's invite and recovery links deliver access_token + refresh_token in
// the URL HASH (implicit flow). @supabase/ssr's browser client defaults to
// PKCE and watches for `?code=`, so it never picked those up: a brand-new,
// perfectly valid link landed here with no session, and this page confidently
// announced that it had expired.
//
// So rather than trusting auto-detection, this reads the URL itself and
// handles both shapes — hash tokens via setSession, `?code=` via
// exchangeCodeForSession. That removes the dependency on which flow the
// project happens to be configured for, which is not something a link
// recipient should be exposed to.
//
// Only ONE case is allowed to report "expired" immediately: Supabase saying so
// itself, via #error / #error_code. Everything else has to fail to produce a
// session first. Telling someone their working link is dead is worse than a
// moment of "checking".

type SessionState = "checking" | "ready" | "missing";

export default function SetPasswordForm({ heading }: { heading: string }) {
  const router = useRouter();
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Requesting a fresh link from the expired state. The email is asked for
  // because this page has no session — that is precisely what expired.
  const [requestEmail, setRequestEmail] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [requestResult, setRequestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const supabase = getBrowserSupabase();

      // 1. Already signed in? (Second visit, or the client resolved it for us.)
      const existing = await supabase.auth.getSession();
      if (cancelled) return;
      if (existing.data.session) {
        setSessionState("ready");
        return;
      }

      // 2. Did Supabase tell us the link itself is bad? Errors come back in
      //    the hash, e.g. #error=access_denied&error_description=Email+link+is+
      //    invalid+or+has+expired. This is the ONLY case that is genuinely
      //    expired, so it is the only one allowed to say so immediately.
      const hash = new URLSearchParams(
        typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : ""
      );
      if (hash.get("error") || hash.get("error_code")) {
        setSessionState("missing");
        return;
      }

      // 3. Consume the token EXPLICITLY rather than trusting auto-detection.
      //    Supabase's invite and recovery links deliver access_token +
      //    refresh_token in the hash (implicit flow), but @supabase/ssr's
      //    browser client defaults to PKCE and watches for ?code=. It
      //    therefore never picked these up, and a perfectly valid link
      //    reported itself as expired. Handling both shapes here removes the
      //    dependency on which flow the project happens to be configured for.
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error: setError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (cancelled) return;
        if (!setError) {
          // Strip the tokens from the address bar so they are not left in
          // history, or copied out of it into a bug report.
          window.history.replaceState({}, "", window.location.pathname);
          setSessionState("ready");
          return;
        }
        setSessionState("missing");
        return;
      }

      // 4. PKCE shape (?code=...), for projects configured that way.
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (!exchangeError) {
          window.history.replaceState({}, "", window.location.pathname);
          setSessionState("ready");
          return;
        }
        setSessionState("missing");
        return;
      }

      // 5. Nothing usable in the URL and no session — the link is spent, or
      //    the page was opened directly.
      setSessionState("missing");
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
      // A session-shaped failure means the link died between loading the page
      // and submitting it. Drop into the expired state so they get the
      // request-a-new-link form rather than a dead end telling them to go
      // find an admin themselves.
      if (/session|jwt|token/i.test(updateError.message)) {
        setSessionState("missing");
        return;
      }
      setError(updateError.message);
      return;
    }
    // Record completion. This is the only moment we can know a password was
    // actually set — Supabase's own last_sign_in_at was stamped when the link
    // was opened, long before this point.
    await markActivatedAction();

    // Already signed in from the magic link, so go straight into the portal
    // rather than bouncing to a login form to retype what was just chosen.
    router.replace(reviewHref(""));
    router.refresh();
  }

  async function requestNew(e: React.FormEvent) {
    e.preventDefault();
    setRequesting(true);
    setRequestResult(null);
    const res = await requestNewInvitationAction(requestEmail);
    setRequesting(false);
    setRequestResult(res);
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
        <h1 className="font-display text-2xl font-medium text-forest">This link has expired</h1>
        <p className="mt-3 text-sm text-ink/75">
          Invitation links work once, and only for a limited time. Request a new one and the
          administrator who invited you will be notified.
        </p>

        {requestResult ? (
          <p
            role="status"
            className={`mt-4 rounded-md px-3 py-2 text-sm ${
              requestResult.ok
                ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {requestResult.message}
          </p>
        ) : null}

        {!requestResult?.ok && (
          <form onSubmit={requestNew} className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="font-semibold text-ink">Your email</span>
              <input
                type="email"
                required
                value={requestEmail}
                onChange={(e) => setRequestEmail(e.target.value)}
                autoComplete="email"
                className="mt-1 h-10 w-full rounded-md border border-ink/15 px-3 outline-none focus-visible:ring-2 focus-visible:ring-forest"
              />
              <span className="mt-1 block text-xs text-ink/55">
                The address your invitation was sent to.
              </span>
            </label>
            <button
              type="submit"
              disabled={requesting || !requestEmail.trim()}
              className="h-10 w-full rounded-md bg-forest px-4 font-semibold text-white hover:bg-forest/90 disabled:opacity-50"
            >
              {requesting ? "Sending…" : "Request a new link"}
            </button>
          </form>
        )}

        <p className="mt-4 text-sm text-ink/70">
          If you already have a password, you can{" "}
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
