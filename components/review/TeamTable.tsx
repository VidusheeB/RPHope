"use client";

// My Team — the roster.
//
// A real table, because this is reference data an admin scans across rather
// than a feed they read down: name, category, email and status line up so
// "who is inactive" or "who has no email" is answerable at a glance.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { reviewHref } from "@/lib/reviewer/paths";
import StatusBadge from "@/components/review/ui/StatusBadge";
import InviteMemberDialog from "./InviteMemberDialog";
import ConfirmDialog from "./ui/ConfirmDialog";
import {
  deactivateMemberAction,
  reactivateMemberAction,
} from "@/app/review/(dashboard)/admin/reviewers/actions";
import type { TeamMember, TeamMemberStatus } from "@/lib/reviewer/team";

const STATUS_LABEL: Record<TeamMemberStatus, string> = {
  invited: "Invited",
  active: "Active",
  inactive: "Inactive",
};

type Filter = "all" | "active" | "inactive" | "admins" | "reviewers";

export default function TeamTable({
  members,
  viewerId,
}: {
  members: TeamMember[];
  viewerId: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState<{ kind: "deactivate"; member: TeamMember } | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (filter === "active" && m.status !== "active" && m.status !== "invited") return false;
      if (filter === "inactive" && m.status !== "inactive") return false;
      if (filter === "admins" && m.role !== "admin") return false;
      if (filter === "reviewers" && m.role !== "reviewer") return false;
      if (!q) return true;
      return (
        m.displayName.toLowerCase().includes(q) || (m.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [members, filter, query]);

  async function run(label: string, id: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(id);
    setMessage(null);
    const res = await fn();
    setBusy(null);
    setConfirming(null);
    setMessage(res.ok ? { ok: true, text: label } : { ok: false, text: res.error ?? "Something went wrong." });
    if (res.ok) router.refresh();
  }

  const FILTERS: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "active", label: "Active" },
    { id: "inactive", label: "Inactive" },
    { id: "admins", label: "Admins" },
    { id: "reviewers", label: "Reviewers" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-forest">My Team</h1>
          <p className="mt-1 text-sm text-ink/60">
            {members.filter((m) => m.status === "active" || m.status === "invited").length} active ·{" "}
            {members.length} total
          </p>
        </div>
        <InviteMemberDialog />
      </div>

      {message && (
        <p
          role="status"
          className={`mt-4 rounded-md px-3 py-2 text-sm ${
            message.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </p>
      )}

      {/* Filters + search */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={`h-8 rounded-md px-3 text-sm font-semibold transition ${
              filter === f.id ? "bg-forest text-white" : "border border-ink/15 text-ink/70 hover:bg-ink/[0.04]"
            }`}
          >
            {f.label}
          </button>
        ))}
        <label htmlFor="team-search" className="sr-only">
          Search by name or email
        </label>
        <input
          id="team-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or email…"
          className="ml-auto h-8 w-full rounded-md border border-ink/15 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-forest sm:w-60"
        />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-ink/10 bg-white">
        <table className="w-full min-w-[46rem] text-sm">
          <caption className="sr-only">RP Hope team members</caption>
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-ink/50">
              <th scope="col" className="px-4 py-3 font-bold">Name</th>
              <th scope="col" className="px-4 py-3 font-bold">Category</th>
              <th scope="col" className="px-4 py-3 font-bold">Email</th>
              <th scope="col" className="px-4 py-3 font-bold">Status</th>
              <th scope="col" className="px-4 py-3 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-ink/60">
                  No team members match that.
                </td>
              </tr>
            )}

            {visible.map((m) => {
              const isSelf = m.userId === viewerId;
              return (
                <tr key={m.userId}>
                  <td className="px-4 py-3">
                    <Link
                      href={reviewHref(`/admin/reviewers/${m.userId}`)}
                      className="font-semibold text-forest underline-offset-2 hover:underline"
                    >
                      {m.displayName}
                    </Link>
                    {isSelf && <span className="ml-2 text-xs text-ink/50">(you)</span>}
                    {m.activeGenes > 0 && (
                      <span className="block text-xs text-ink/55">
                        {m.activeGenes} active {m.activeGenes === 1 ? "gene" : "genes"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize text-ink/80">{m.role}</td>
                  <td className="px-4 py-3 text-ink/70">{m.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={STATUS_LABEL[m.status]} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      {m.status === "inactive" ? (
                          <button
                            type="button"
                            disabled={busy === m.userId}
                            onClick={() => run("Reactivated.", m.userId, () => reactivateMemberAction(m.userId))}
                            className="h-8 rounded-md border border-ink/20 px-2.5 text-xs font-semibold text-ink/80 hover:bg-ink/[0.04] disabled:opacity-50"
                          >
                            Reactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy === m.userId || isSelf}
                            onClick={() => setConfirming({ kind: "deactivate", member: m })}
                            className="h-8 rounded-md border border-ink/20 px-2.5 text-xs font-semibold text-ink/80 hover:bg-ink/[0.04] disabled:opacity-40"
                          >
                            Deactivate
                          </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {confirming?.kind === "deactivate" && (
        <ConfirmDialog
          title={`Deactivate ${confirming.member.displayName}?`}
          confirmLabel="Deactivate"
          onCancel={() => setConfirming(null)}
          onConfirm={() =>
            run("Deactivated.", confirming.member.userId, () =>
              deactivateMemberAction(confirming.member.userId)
            )
          }
          busy={busy === confirming.member.userId}
        >
          <p>
            They lose access immediately. Their reviews, approvals and conversations are kept, and
            you can reactivate them at any time.
          </p>
          {confirming.member.activeGenes > 0 && (
            <p className="mt-2 font-semibold">
              They currently have {confirming.member.activeGenes}{" "}
              {confirming.member.activeGenes === 1 ? "gene" : "genes"} in review. Those stay assigned
              to them until you reassign.
            </p>
          )}
        </ConfirmDialog>
      )}

    </div>
  );
}
