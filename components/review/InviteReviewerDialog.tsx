"use client";

// Invite Reviewer modal — replaces the old permanent inline form. Preserves
// field values on a recoverable failure (only clears on success), disables
// submit while in flight (prevents a double-click firing two invitations),
// and shows a specific error rather than a generic one.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inviteReviewerAction } from "@/app/review/actions";

export default function InviteReviewerDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"reviewer" | "admin">("reviewer");
  const [canPublish, setCanPublish] = useState(false);
  const [title, setTitle] = useState("");
  const [organization, setOrganization] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  function reset() {
    setEmail("");
    setName("");
    setRole("reviewer");
    setCanPublish(false);
    setTitle("");
    setOrganization("");
    setSpecialty("");
    setAdminNotes("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return; // idempotent guard against a double-click double-send
    setSubmitting(true);
    setError(null);
    const res = await inviteReviewerAction({
      email,
      displayName: name,
      role,
      canPublish,
      title,
      organization,
      specialty,
      adminNotes,
    });
    setSubmitting(false);
    if (res.ok) {
      setSuccess(`Invitation sent to ${email}.`);
      reset();
      router.refresh();
    } else {
      // Deliberately do NOT clear fields on failure — the admin shouldn't
      // have to retype everything after a recoverable error.
      setError(res.error);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setSuccess(null);
        }}
        className="rounded bg-forest px-4 py-2 text-sm font-semibold text-white"
      >
        Invite reviewer
      </button>

      {success && !open && <p className="mt-3 text-sm text-forest">{success}</p>}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4" role="presentation" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Invite reviewer"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-medium text-ink">Invite a reviewer</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded p-1 text-ink/60 hover:text-ink">
                ✕
              </button>
            </div>

            <form onSubmit={submit} className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="font-semibold text-ink/70">Email</span>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded border border-ink/20 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-semibold text-ink/70">Display name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded border border-ink/20 px-3 py-2" />
              </label>
              <label className="block text-sm">
                <span className="font-semibold text-ink/70">Professional title (optional)</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded border border-ink/20 px-3 py-2" />
              </label>
              <label className="block text-sm">
                <span className="font-semibold text-ink/70">Organization (optional)</span>
                <input value={organization} onChange={(e) => setOrganization(e.target.value)} className="mt-1 w-full rounded border border-ink/20 px-3 py-2" />
              </label>
              <label className="block text-sm">
                <span className="font-semibold text-ink/70">Specialty (optional)</span>
                <input value={specialty} onChange={(e) => setSpecialty(e.target.value)} className="mt-1 w-full rounded border border-ink/20 px-3 py-2" />
              </label>
              <label className="block text-sm">
                <span className="font-semibold text-ink/70">Private admin notes (optional)</span>
                <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={2} className="mt-1 w-full rounded border border-ink/20 px-3 py-2" />
              </label>
              <label className="block text-sm">
                <span className="font-semibold text-ink/70">Role</span>
                <select value={role} onChange={(e) => setRole(e.target.value as "reviewer" | "admin")} className="mt-1 w-full rounded border border-ink/20 px-3 py-2">
                  <option value="reviewer">Reviewer</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={canPublish} onChange={(e) => setCanPublish(e.target.checked)} />
                Can publish
              </label>

              {error && <p className="text-sm text-maroon">{error}</p>}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded bg-forest px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "Sending…" : "Send invitation"}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="rounded border border-ink/20 px-4 py-2 text-sm font-semibold text-ink">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
