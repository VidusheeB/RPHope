"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changePasswordAction, updateDisplayNameAction } from "@/app/review/(dashboard)/settings/actions";

// Your own account. Everything here is self-scoped — the server derives the
// target user from the session, so nothing on this page can be pointed at
// somebody else's account.
//
// Role and publishing permission are shown READ-ONLY on purpose: they are
// granted by an admin from My Team, and a field you can see but not change is
// more honest than hiding what governs your access.

export default function SettingsPanel({
  email,
  displayName,
  role,
  canPublish,
}: {
  email: string | null;
  displayName: string;
  role: string;
  canPublish: boolean;
}) {
  const router = useRouter();

  const [name, setName] = useState(displayName);
  const [nameBusy, setNameBusy] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setNameBusy(true);
    setNameMsg(null);
    const res = await updateDisplayNameAction(name);
    setNameBusy(false);
    setNameMsg(res.ok ? { ok: true, text: "Name updated." } : { ok: false, text: res.error });
    if (res.ok) router.refresh();
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    // Checked here for instant feedback; the server independently enforces
    // length and the current-password check.
    if (next !== confirm) {
      setPwMsg({ ok: false, text: "The two new passwords don't match." });
      return;
    }
    setPwBusy(true);
    setPwMsg(null);
    const res = await changePasswordAction({ currentPassword: current, newPassword: next });
    setPwBusy(false);
    if (res.ok) {
      setCurrent("");
      setNext("");
      setConfirm("");
      setPwMsg({ ok: true, text: "Password changed. It's in effect now." });
    } else {
      setPwMsg({ ok: false, text: res.error });
    }
  }

  const field =
    "h-10 w-full rounded-md border border-ink/15 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-forest";

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-semibold text-forest">Settings</h1>
      <p className="mt-1 text-sm text-ink/60">Your account in the RP Hope Team Portal.</p>

      {/* ---- Account ---- */}
      <section className="mt-8 rounded-xl border border-ink/10 bg-white p-5">
        <h2 className="text-base font-semibold text-ink">Account</h2>

        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <dt className="w-28 shrink-0 text-ink/60">Email</dt>
            <dd className="text-ink">{email ?? "—"}</dd>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <dt className="w-28 shrink-0 text-ink/60">Role</dt>
            <dd className="capitalize text-ink">{role}</dd>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <dt className="w-28 shrink-0 text-ink/60">Publishing</dt>
            <dd className="text-ink">
              {canPublish ? "Permitted" : "Not permitted"}
              <span className="ml-2 text-xs text-ink/50">Set by an administrator</span>
            </dd>
          </div>
        </dl>

        <form onSubmit={saveName} className="mt-6 border-t border-ink/10 pt-5">
          <label htmlFor="display-name" className="block text-sm font-semibold text-ink">
            Display name
          </label>
          <p className="mt-0.5 text-xs text-ink/55">
            Shown next to your work — assignments, approvals and conversations.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              id="display-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${field} sm:max-w-xs`}
              autoComplete="name"
            />
            <button
              type="submit"
              disabled={nameBusy || name.trim() === displayName}
              className="h-10 rounded-md bg-forest px-4 text-sm font-semibold text-white hover:bg-forest/90 disabled:opacity-40"
            >
              {nameBusy ? "Saving…" : "Save"}
            </button>
          </div>
          {nameMsg && (
            <p
              role="status"
              className={`mt-2 text-sm ${nameMsg.ok ? "text-emerald-700" : "text-red-700"}`}
            >
              {nameMsg.text}
            </p>
          )}
        </form>
      </section>

      {/* ---- Password ---- */}
      <section className="mt-6 rounded-xl border border-ink/10 bg-white p-5">
        <h2 className="text-base font-semibold text-ink">Password</h2>
        <p className="mt-0.5 text-sm text-ink/60">
          Change your password without needing a reset email.
        </p>

        <form onSubmit={savePassword} className="mt-4 space-y-4">
          {/* Helps password managers associate the change with the right
              account; hidden from view but present for autofill. */}
          <input
            type="text"
            name="username"
            autoComplete="username"
            value={email ?? ""}
            readOnly
            hidden
          />

          <div>
            <label htmlFor="current-password" className="block text-sm font-semibold text-ink">
              Current password
            </label>
            <input
              id="current-password"
              type="password"
              required
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={`${field} mt-1.5 sm:max-w-sm`}
            />
          </div>

          <div>
            <label htmlFor="new-password" className="block text-sm font-semibold text-ink">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              aria-describedby="password-rule"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className={`${field} mt-1.5 sm:max-w-sm`}
            />
            <p id="password-rule" className="mt-1 text-xs text-ink/55">
              At least 8 characters.
            </p>
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-semibold text-ink">
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={`${field} mt-1.5 sm:max-w-sm`}
            />
          </div>

          <button
            type="submit"
            disabled={pwBusy || !current || !next || !confirm}
            className="h-10 rounded-md bg-forest px-4 text-sm font-semibold text-white hover:bg-forest/90 disabled:opacity-40"
          >
            {pwBusy ? "Changing…" : "Change password"}
          </button>

          {pwMsg && (
            <p
              role="status"
              className={`text-sm ${pwMsg.ok ? "text-emerald-700" : "text-red-700"}`}
            >
              {pwMsg.text}
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
