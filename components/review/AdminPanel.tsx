"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inviteReviewerAction, updateReviewerAction } from "@/app/review/actions";

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

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"reviewer" | "admin">("reviewer");
  const [canPublish, setCanPublish] = useState(false);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const res = await inviteReviewerAction({ email, displayName: name, role, canPublish });
    setMsg(res.ok ? `Invitation sent to ${email}.` : res.error);
    if (res.ok) {
      setEmail("");
      setName("");
      router.refresh();
    }
  }

  async function toggle(userId: string, patch: { active?: boolean; canPublish?: boolean }) {
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
        <h2 className="font-display text-xl font-medium text-ink">Invite a reviewer</h2>
        <form onSubmit={invite} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input required type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded border border-ink/20 px-3 py-2" />
          <input placeholder="display name" value={name} onChange={(e) => setName(e.target.value)} className="rounded border border-ink/20 px-3 py-2" />
          <select value={role} onChange={(e) => setRole(e.target.value as "reviewer" | "admin")} className="rounded border border-ink/20 px-3 py-2">
            <option value="reviewer">Reviewer</option>
            <option value="admin">Admin</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={canPublish} onChange={(e) => setCanPublish(e.target.checked)} />
            Can publish
          </label>
          <button type="submit" className="rounded bg-forest px-4 py-2 font-semibold text-white sm:col-span-2">
            Send invitation
          </button>
        </form>
      </section>

      <section>
        <h2 className="font-display text-xl font-medium text-ink">Reviewers</h2>
        <ul className="mt-3 space-y-2">
          {reviewers.map((r) => (
            <li key={r.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-ink/12 bg-white p-3 text-sm">
              <span>
                {r.display_name || r.user_id} · {r.role}
                {r.active ? "" : " · inactive"}
              </span>
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
