"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateReviewerAction } from "@/app/review/actions";
import { reviewHref } from "@/lib/reviewer/paths";
import InviteReviewerDialog from "./InviteReviewerDialog";

type Reviewer = {
  user_id: string;
  display_name: string;
  role: "reviewer" | "admin";
  can_publish: boolean;
  active: boolean;
};

export default function AdminPanel({ reviewers }: { reviewers: Reviewer[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  async function toggle(userId: string, patch: { active?: boolean; canPublish?: boolean }) {
    if (patch.active === false && !confirm("Deactivate this reviewer? They will lose access immediately; any active assignments stay visible but blocked until reassigned.")) {
      return;
    }
    const res = await updateReviewerAction({ userId, ...patch });
    setMsg(res.ok ? "Reviewer updated." : res.error);
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-10">
      {msg ? (
        <p className="rounded bg-forest/5 p-3 text-sm text-ink/80" role="status">
          {msg}
        </p>
      ) : null}

      <section>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-medium text-ink">Invite a reviewer</h2>
            <p className="text-sm text-ink/60">Send an invitation with a role, publish permission, and professional info.</p>
          </div>
          <InviteReviewerDialog />
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl font-medium text-ink">Reviewers</h2>
        <ul className="mt-3 space-y-2">
          {reviewers.map((r) => (
            <li key={r.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-ink/12 bg-white p-3 text-sm">
              <Link href={reviewHref(`/admin/reviewers/${r.user_id}`)} className="font-semibold text-forest underline">
                {r.display_name || r.user_id} · {r.role}
                {r.active ? "" : " · inactive"}
              </Link>
              <span className="flex gap-2">
                <button onClick={() => toggle(r.user_id, { canPublish: !r.can_publish })} className="rounded border border-ink/20 px-2 py-1 text-xs">
                  {r.can_publish ? "Revoke publish" : "Grant publish"}
                </button>
                <button onClick={() => toggle(r.user_id, { active: !r.active })} className="rounded border border-ink/20 px-2 py-1 text-xs">
                  {r.active ? "Deactivate" : "Reactivate"}
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
