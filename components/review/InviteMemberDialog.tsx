"use client";

// Add a team member.
//
// Invites an ADMIN or a REVIEWER — it was previously titled "Invite reviewer"
// while already offering both, which made the admin case look unsupported.
//
// The invitation is a single-use activation link, never a password: the
// recipient sets their own, so nobody else ever knows it. Emailing a
// credential would leave it in an inbox and in mail logs permanently, for an
// account that can publish medical content.
//
// Any email domain is accepted. Reviewers are outside volunteers who sign in
// with their own address; only RP Hope staff have @rphope.org. That is a
// system rule, deliberately NOT explained in the UI — an admin typing an
// address does not need to be told which domains are allowed.
//
// Accessibility: focus moves in on open, Escape closes, Tab is trapped, focus
// returns to the trigger. Matches ConfirmDialog and AssignReviewerDialog.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { inviteReviewerAction } from "@/app/review/actions";

type Role = "reviewer" | "admin";

export default function InviteMemberDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("reviewer");
  const [title, setTitle] = useState("");
  const [organization, setOrganization] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    firstFieldRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  function reset() {
    setEmail("");
    setName("");
    setRole("reviewer");
    setTitle("");
    setOrganization("");
    setSpecialty("");
    setAdminNotes("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return; // guards a double-click sending two invitations
    setSubmitting(true);
    setError(null);
    const res = await inviteReviewerAction({
      email: email.trim(),
      displayName: name.trim(),
      role,
      // Publishing follows the role; there is no per-person publish flag.
      canPublish: false,
      title: title.trim(),
      organization: organization.trim(),
      specialty: specialty.trim(),
      adminNotes: adminNotes.trim(),
    });
    setSubmitting(false);
    if (res.ok) {
      setSuccess(`Invitation sent to ${email.trim()}.`);
      reset();
      setOpen(false);
      router.refresh();
    } else {
      // Never clear the fields on a recoverable failure — retyping everything
      // after a duplicate-email error is a small cruelty.
      setError(res.error);
    }
  }

  const field =
    "mt-1 h-10 w-full rounded-md border border-ink/15 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-forest";
  const labelText = "block text-sm font-semibold text-ink";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setSuccess(null);
          setError(null);
        }}
        className="h-9 rounded-md bg-forest px-3 text-sm font-semibold text-white hover:bg-forest/90"
      >
        Add team member
      </button>

      {success && !open && (
        <p role="status" className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {success}
        </p>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/40" role="presentation" onClick={() => setOpen(false)} />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-title"
            className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-ink/10 bg-white shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
              <h2 id="invite-title" className="font-display text-lg font-semibold text-forest">
                Add team member
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded p-1 text-ink/60 hover:bg-ink/5 hover:text-ink"
              >
                ✕
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4 px-5 py-4">
              {/* Role first: it changes what this person will see, so it is
                  the decision being made, not a footnote under optional
                  professional details. */}
              <div>
                <label htmlFor="invite-role" className={labelText}>
                  Role
                </label>
                <select
                  id="invite-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className={`${field} bg-white`}
                >
                  <option value="reviewer">Reviewer — reviews genes assigned to them</option>
                  <option value="admin">Admin — full access to the portal</option>
                </select>
              </div>

              <div>
                <label htmlFor="invite-name" className={labelText}>
                  Full name
                </label>
                <input
                  id="invite-name"
                  ref={firstFieldRef}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className={field}
                />
                <p className="mt-1 text-xs text-ink/55">
                  Shown next to their work across the portal.
                </p>
              </div>

              <div>
                <label htmlFor="invite-email" className={labelText}>
                  Email
                </label>
                <input
                  id="invite-email"
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className={field}
                />
                <p className="mt-1 text-xs text-ink/55">
                  The invitation goes here, and this is the address they&apos;ll sign in with.
                </p>
              </div>

              <details className="rounded-md border border-ink/10 px-3 py-2">
                <summary className="cursor-pointer text-sm font-semibold text-ink/75">
                  Professional details (optional)
                </summary>
                <div className="mt-3 space-y-3">
                  <div>
                    <label htmlFor="invite-title" className={labelText}>
                      Professional title
                    </label>
                    <input id="invite-title" value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
                  </div>
                  <div>
                    <label htmlFor="invite-org" className={labelText}>
                      Organization
                    </label>
                    <input id="invite-org" value={organization} onChange={(e) => setOrganization(e.target.value)} className={field} />
                  </div>
                  <div>
                    <label htmlFor="invite-specialty" className={labelText}>
                      Specialty
                    </label>
                    <input id="invite-specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)} className={field} />
                  </div>
                  <div>
                    <label htmlFor="invite-notes" className={labelText}>
                      Private notes
                    </label>
                    <textarea
                      id="invite-notes"
                      rows={2}
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      className="mt-1 w-full rounded-md border border-ink/15 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-forest"
                    />
                    <p className="mt-1 text-xs text-ink/55">Only admins can see these.</p>
                  </div>
                </div>
              </details>

              <p className="rounded-md bg-mint/30 px-3 py-2 text-xs text-ink/75">
                They&apos;ll get an email with a link to set their own password. No password is ever
                sent by email.
              </p>

              {error && (
                <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2 border-t border-ink/10 pt-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-9 rounded-md border border-ink/20 px-3 text-sm font-semibold text-ink/70 hover:bg-ink/[0.04]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !email.trim() || !name.trim()}
                  className="h-9 rounded-md bg-forest px-3 text-sm font-semibold text-white hover:bg-forest/90 disabled:opacity-40"
                >
                  {submitting ? "Sending…" : "Send invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
