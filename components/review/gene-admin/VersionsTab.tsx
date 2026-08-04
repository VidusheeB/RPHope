"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { restoreVersionAction } from "@/app/review/actions";
import { reviewHref } from "@/lib/reviewer/paths";
import type { GeneVersionRow } from "@/lib/reviewer/geneDetail";

export default function VersionsTab({ versions, draftId }: { versions: GeneVersionRow[]; draftId: string }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function restore(versionId: string) {
    if (
      !confirm(
        "Restore this version into a new draft? The historical snapshot is preserved unchanged — nothing publishes automatically, and the live site is untouched until this new draft is reviewed and published."
      )
    ) {
      return;
    }
    setBusyId(versionId);
    const res = await restoreVersionAction(versionId);
    setBusyId(null);
    if (res.ok && res.data) {
      router.push(reviewHref(`/admin/genes/${res.data.draftId}`));
    } else if (!res.ok) {
      setMsg(res.error);
    }
  }

  if (versions.length === 0) {
    return (
      <p className="rounded-lg border border-ink/10 bg-white p-4 text-sm text-ink/60">
        This gene has never been published — there&apos;s only the current draft (id {draftId.slice(0, 8)}).
      </p>
    );
  }

  return (
    <div>
      {msg && <p className="mb-3 text-sm text-maroon">{msg}</p>}
      <ul className="space-y-2">
        {versions.map((v) => (
          <li key={v.id} className="rounded-lg border border-ink/10 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">
                  Version {v.versionNumber}{" "}
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      v.status === "published" ? "bg-forest text-white" : "bg-ink/10 text-ink/60"
                    }`}
                  >
                    {v.status}
                  </span>
                </p>
                <p className="mt-1 text-xs text-ink/60">
                  Created {new Date(v.createdAt).toLocaleString()}
                  {v.publishedAt && ` · published ${new Date(v.publishedAt).toLocaleString()}`}
                  {v.approvedByName && ` · approved by ${v.approvedByName}`}
                  {v.unpublishedAt && ` · unpublished ${new Date(v.unpublishedAt).toLocaleString()}${v.unpublishedByName ? ` by ${v.unpublishedByName}` : ""}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => restore(v.id)}
                disabled={busyId === v.id}
                className="rounded border border-ink/20 px-3 py-1.5 text-xs font-semibold text-ink hover:border-forest disabled:opacity-50"
              >
                {busyId === v.id ? "Restoring…" : "Restore into new draft"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
