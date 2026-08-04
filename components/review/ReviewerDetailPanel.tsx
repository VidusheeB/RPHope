"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  updateReviewerAction,
  resendInvitationAction,
  assignDraftAction,
} from "@/app/review/actions";
import { reviewHref } from "@/lib/reviewer/paths";
import { REVIEW_STATE_LABELS, PUBLICATION_STATE_LABELS } from "@/lib/reviewer/dashboardStatus";
import type { ReviewerDetail } from "@/lib/reviewer/reviewerDetail";

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}

export default function ReviewerDetailPanel({
  detail,
  otherReviewers,
}: {
  detail: ReviewerDetail;
  otherReviewers: { user_id: string; display_name: string }[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [deactivateChoice, setDeactivateChoice] = useState(false);
  const [reassigning, setReassigning] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState(detail.displayName);
  const [title, setTitle] = useState(detail.title ?? "");
  const [organization, setOrganization] = useState(detail.organization ?? "");
  const [specialty, setSpecialty] = useState(detail.specialty ?? "");
  const [adminNotes, setAdminNotes] = useState(detail.adminNotes ?? "");

  const invitationStatus = detail.acceptedAt ? "accepted" : "invited (pending)";

  async function saveProfile() {
    const res = await updateReviewerAction({
      userId: detail.userId,
      displayName,
      title,
      organization,
      specialty,
      adminNotes,
    });
    setMsg(res.ok ? "Saved." : res.error);
    if (res.ok) router.refresh();
  }

  async function toggleActive(active: boolean) {
    if (active === false && detail.activeAssignments.length > 0) {
      setDeactivateChoice(true);
      return;
    }
    if (!active && !confirm(`Deactivate ${detail.displayName}? They will lose access immediately.`)) return;
    const res = await updateReviewerAction({ userId: detail.userId, active });
    setMsg(res.ok ? "Updated." : res.error);
    if (res.ok) router.refresh();
  }

  async function deactivateAnyway() {
    const res = await updateReviewerAction({ userId: detail.userId, active: false });
    setMsg(res.ok ? "Deactivated. Their assignments remain visible but are now blocked until reassigned." : res.error);
    setDeactivateChoice(false);
    if (res.ok) router.refresh();
  }

  async function resend() {
    const res = await resendInvitationAction(detail.userId);
    setMsg(res.ok ? "Invitation resent." : res.error);
  }

  async function reassign(draftId: string, reviewerId: string) {
    const res = await assignDraftAction({ draftId, reviewerId, confirmed: true });
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setReassigning(null);
    router.refresh();
  }

  return (
    <div className="mt-4 space-y-8">
      {msg && (
        <p className="rounded bg-forest/5 p-3 text-sm text-ink/80" role="status">
          {msg}
        </p>
      )}

      <div>
        <h1 className="font-display text-2xl font-medium text-forest">{detail.displayName || detail.email}</h1>
        <p className="mt-1 text-sm text-ink/60">
          {detail.email} · {detail.role} · {detail.active ? "active" : "inactive"} · {invitationStatus}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-ink/10 bg-white p-4">
          <h2 className="font-display text-lg font-medium text-ink">Profile</h2>
          <div className="mt-3 grid gap-3">
            <label className="text-sm">
              <span className="font-semibold text-ink/70">Display name</span>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1 w-full rounded border border-ink/20 px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="font-semibold text-ink/70">Professional title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded border border-ink/20 px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="font-semibold text-ink/70">Organization</span>
              <input value={organization} onChange={(e) => setOrganization(e.target.value)} className="mt-1 w-full rounded border border-ink/20 px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="font-semibold text-ink/70">Specialty</span>
              <input value={specialty} onChange={(e) => setSpecialty(e.target.value)} className="mt-1 w-full rounded border border-ink/20 px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="font-semibold text-ink/70">Admin notes (private)</span>
              <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={2} className="mt-1 w-full rounded border border-ink/20 px-3 py-2" />
            </label>
            <button onClick={saveProfile} className="rounded bg-forest px-4 py-2 text-sm font-semibold text-white">
              Save profile
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-ink/10 bg-white p-4">
          <h2 className="font-display text-lg font-medium text-ink">Account</h2>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-ink/55">Invited</dt><dd className="font-semibold text-ink">{fmt(detail.invitedAt)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink/55">Accepted</dt><dd className="font-semibold text-ink">{detail.acceptedAt ? fmt(detail.acceptedAt) : "Not yet"}</dd></div>
            <div className="flex justify-between"><dt className="text-ink/55">Last active</dt><dd className="font-semibold text-ink">{fmt(detail.lastActiveAt)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink/55">Active assignments</dt><dd className="font-semibold text-ink">{detail.activeAssignments.length}</dd></div>
            <div className="flex justify-between"><dt className="text-ink/55">Completed reviews</dt><dd className="font-semibold text-ink">{detail.completedCount}</dd></div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            {!detail.acceptedAt && (
              <button onClick={resend} className="rounded border border-ink/20 px-3 py-1.5 text-xs font-semibold text-ink hover:border-forest">
                Resend invitation
              </button>
            )}
            <button
              onClick={() => toggleActive(!detail.active)}
              className={`rounded border px-3 py-1.5 text-xs font-semibold ${
                detail.active ? "border-maroon/40 text-maroon hover:bg-maroon/5" : "border-ink/20 text-ink hover:border-forest"
              }`}
            >
              {detail.active ? (detail.acceptedAt ? "Deactivate" : "Cancel invitation") : "Reactivate"}
            </button>
            <button
              onClick={async () => {
                const res = await updateReviewerAction({ userId: detail.userId, canPublish: !detail.canPublish });
                setMsg(res.ok ? "Updated." : res.error);
                if (res.ok) router.refresh();
              }}
              className="rounded border border-ink/20 px-3 py-1.5 text-xs font-semibold text-ink hover:border-forest"
            >
              {detail.canPublish ? "Revoke publish permission" : "Grant publish permission"}
            </button>
          </div>

          {deactivateChoice && (
            <div className="mt-4 rounded border border-gold/50 bg-butter/40 p-3 text-sm">
              <p className="font-semibold text-ink">
                {detail.displayName} has {detail.activeAssignments.length} active assignment(s).
              </p>
              <p className="mt-1 text-ink/70">Choose how to handle them before deactivating:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-ink/70">
                <li>Reassign each one below (see Active assignments) before deactivating, or</li>
                <li>Deactivate now — assignments stay visible but blocked until reassigned.</li>
              </ul>
              <div className="mt-3 flex gap-2">
                <button onClick={deactivateAnyway} className="rounded bg-maroon px-3 py-1.5 text-xs font-semibold text-white">
                  Deactivate now, leave blocked
                </button>
                <button onClick={() => setDeactivateChoice(false)} className="rounded border border-ink/20 px-3 py-1.5 text-xs font-semibold text-ink">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      <section>
        <h2 className="font-display text-lg font-medium text-ink">Active assignments ({detail.activeAssignments.length})</h2>
        {detail.activeAssignments.length === 0 ? (
          <p className="mt-3 rounded-lg border border-ink/10 bg-white p-4 text-sm text-ink/60">No active assignments.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {detail.activeAssignments.map((a) => (
              <li key={a.draftId} className="rounded-lg border border-ink/10 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{a.geneSymbol}</p>
                    <p className="text-xs text-ink/50">
                      {REVIEW_STATE_LABELS[a.reviewState]} · {PUBLICATION_STATE_LABELS[a.publicationState]} · assigned {fmt(a.assignedAt)}
                      {a.sentencesTotal > 0 ? ` · ${a.sentencesVerified}/${a.sentencesTotal} verified` : ""}
                      {a.openFlags > 0 ? ` · ${a.openFlags} open flags` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={reviewHref(`/admin/genes/${a.draftId}`)} className="rounded bg-forest px-3 py-1.5 text-xs font-semibold text-white">
                      Open
                    </Link>
                    {reassigning === a.draftId ? (
                      <select
                        autoFocus
                        defaultValue=""
                        onChange={(e) => reassign(a.draftId, e.target.value)}
                        onBlur={() => setReassigning(null)}
                        className="rounded border border-ink/20 px-2 py-1 text-xs"
                      >
                        <option value="" disabled>
                          Choose reviewer…
                        </option>
                        {otherReviewers.map((r) => (
                          <option key={r.user_id} value={r.user_id}>
                            {r.display_name || r.user_id}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <button onClick={() => setReassigning(a.draftId)} className="text-xs font-semibold text-forest underline">
                        Reassign
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-medium text-ink">Completed reviews ({detail.completedCount})</h2>
        {detail.completedReviews.length === 0 ? (
          <p className="mt-3 rounded-lg border border-ink/10 bg-white p-4 text-sm text-ink/60">No completed reviews yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {detail.completedReviews.map((c) => (
              <li key={c.draftId} className="flex items-center justify-between rounded-lg border border-ink/10 bg-white p-3 text-sm">
                <span>
                  {c.geneSymbol} · submitted {fmt(c.submittedAt)}
                  {c.approvedAt ? ` · approved ${fmt(c.approvedAt)}` : ""} · {PUBLICATION_STATE_LABELS[c.publicationState]}
                </span>
                <Link href={reviewHref(`/admin/genes/${c.draftId}`)} className="text-xs font-semibold text-forest underline">
                  View activity
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
