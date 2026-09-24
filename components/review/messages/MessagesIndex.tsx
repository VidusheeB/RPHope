"use client";

// Direct messages — the thread list, plus composing a new one.
//
// Reads like a texting app: threads are named by who is in them, the preview
// is the last thing said, and unread is a weight change rather than a badge
// farm. This is NOT tickets — nothing here is delegated, triaged or resolved,
// and no admin can see a thread they aren't in.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { reviewHref } from "@/lib/reviewer/paths";
import { startThreadAction } from "@/app/review/(dashboard)/messages/actions";
import { threadLabel, type ThreadParticipant, type ThreadSummary } from "@/lib/reviewer/messageModel";

function relative(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d`;
}

export default function MessagesIndex({
  threads,
  members,
}: {
  threads: ThreadSummary[];
  members: ThreadParticipant[];
}) {
  const router = useRouter();
  const [composing, setComposing] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? members.filter((m) => m.displayName.toLowerCase().includes(q)) : members;
  }, [members, query]);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await startThreadAction({
      recipientIds: Array.from(picked),
      body,
      title: picked.size > 1 ? title : undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(reviewHref(`/messages/${res.data!.id}`));
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-forest">Messages</h1>
          <p className="mt-1 text-sm text-ink/60">
            Private conversations with your teammates. Only the people in a message can read it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setComposing((v) => !v)}
          className="h-9 rounded-md bg-forest px-3 text-sm font-semibold text-white hover:bg-forest/90"
        >
          New message
        </button>
      </div>

      {composing && (
        <form onSubmit={start} className="mt-5 rounded-xl border border-ink/10 bg-white p-4">
          <fieldset>
            <legend className="text-sm font-semibold text-ink">To</legend>

            {picked.size > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {Array.from(picked).map((id) => {
                  const m = members.find((x) => x.userId === id);
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => toggle(id)}
                        className="flex items-center gap-1.5 rounded-full bg-mint/60 px-2.5 py-1 text-xs font-semibold text-forest hover:bg-mint"
                      >
                        {m?.displayName ?? "Someone"}
                        <span aria-hidden="true">×</span>
                        <span className="sr-only">Remove {m?.displayName}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <label htmlFor="member-search" className="sr-only">
              Search teammates
            </label>
            <input
              id="member-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search teammates…"
              className="mt-2 h-10 w-full rounded-md border border-ink/15 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-forest"
            />

            <ul className="mt-2 max-h-44 overflow-y-auto rounded-md border border-ink/10">
              {matches.length === 0 && (
                <li className="px-3 py-4 text-center text-sm text-ink/60">No teammates match that.</li>
              )}
              {matches.map((m) => (
                <li key={m.userId}>
                  <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-mint/20">
                    <input
                      type="checkbox"
                      checked={picked.has(m.userId)}
                      onChange={() => toggle(m.userId)}
                      className="h-4 w-4 rounded border-ink/30 accent-[#234b43]"
                    />
                    {m.displayName}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          {/* Only groups get a name; a 1:1 is named by the other person. */}
          {picked.size > 1 && (
            <>
              <label htmlFor="thread-title" className="mt-4 block text-sm font-semibold text-ink">
                Group name <span className="font-normal text-ink/55">(optional)</span>
              </label>
              <input
                id="thread-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-md border border-ink/15 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-forest"
              />
            </>
          )}

          <label htmlFor="first-message" className="mt-4 block text-sm font-semibold text-ink">
            Message
          </label>
          <textarea
            id="first-message"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-ink/15 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-forest"
          />

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setComposing(false)}
              className="h-9 rounded-md border border-ink/20 px-3 text-sm font-semibold text-ink/70 hover:bg-ink/[0.04]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || picked.size === 0 || !body.trim()}
              className="h-9 rounded-md bg-forest px-3 text-sm font-semibold text-white hover:bg-forest/90 disabled:opacity-40"
            >
              {busy ? "Sending…" : "Send"}
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </form>
      )}

      <ul className="mt-5 divide-y divide-ink/10 overflow-hidden rounded-xl border border-ink/10 bg-white">
        {threads.length === 0 && (
          <li className="px-4 py-12 text-center text-sm text-ink/60">
            No messages yet. Start one with a teammate.
          </li>
        )}
        {threads.map((t) => (
          <li key={t.id}>
            <Link
              href={reviewHref(`/messages/${t.id}`)}
              className="flex items-center gap-3 px-4 py-3 transition hover:bg-mint/20"
            >
              {/* Unread is a dot plus bolder text — never colour alone. */}
              <span
                aria-hidden="true"
                className={`h-2 w-2 shrink-0 rounded-full ${t.unread ? "bg-forest" : "bg-transparent"}`}
              />
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate ${t.unread ? "font-bold text-ink" : "font-semibold text-ink/85"}`}
                >
                  {threadLabel(t.others, t.title)}
                  {t.unread && <span className="sr-only"> (unread)</span>}
                </span>
                <span className={`block truncate text-sm ${t.unread ? "text-ink/80" : "text-ink/55"}`}>
                  {t.lastMessageAuthor ? `${t.lastMessageAuthor}: ` : ""}
                  {t.lastMessage}
                </span>
              </span>
              <span className="shrink-0 text-xs text-ink/50">{relative(t.lastMessageAt)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
