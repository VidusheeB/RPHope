"use client";

// One message thread. Chat bubbles, newest at the bottom, composer pinned
// under it — the shape everyone already knows from texting.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { reviewHref } from "@/lib/reviewer/paths";
import { sendMessageAction, markThreadReadAction } from "@/app/review/(dashboard)/messages/actions";
import { threadLabel, type ThreadDetail } from "@/lib/reviewer/messageModel";

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Group consecutive messages from the same person so a burst of three reads
 *  as one turn rather than three stamped blocks. */
function showsAuthor(messages: ThreadDetail["messages"], i: number): boolean {
  if (i === 0) return true;
  return messages[i - 1].author !== messages[i].author;
}

export default function MessageThread({ thread }: { thread: ThreadDetail }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [thread.messages.length]);

  // Opening a thread is what marks it read — the same expectation texting
  // sets. Fire-and-forget; a failed mark just leaves it bold.
  useEffect(() => {
    void markThreadReadAction(thread.id);
  }, [thread.id]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    const res = await sendMessageAction({ threadId: thread.id, body });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col">
      <Link
        href={reviewHref("/messages")}
        className="text-sm font-semibold text-ink/60 underline-offset-2 hover:text-forest hover:underline"
      >
        ← Messages
      </Link>

      <div className="mt-2 border-b border-ink/10 pb-3">
        <h1 className="font-display text-xl font-semibold text-forest">
          {threadLabel(thread.others, thread.title)}
        </h1>
        {thread.isGroup && (
          <p className="mt-0.5 text-xs text-ink/55">
            {thread.participants.map((p) => p.displayName).join(", ")}
          </p>
        )}
      </div>

      <ol className="mt-4 flex-1 space-y-2">
        {thread.messages.length === 0 && (
          <li className="py-8 text-center text-sm text-ink/60">No messages yet.</li>
        )}
        {thread.messages.map((m, i) => (
          <li key={m.id} className={m.isMine ? "flex justify-end" : "flex justify-start"}>
            <div className={`max-w-[80%] ${m.isMine ? "items-end" : "items-start"}`}>
              {showsAuthor(thread.messages, i) && (
                <p className={`text-xs text-ink/55 ${m.isMine ? "text-right" : "text-left"}`}>
                  <span className="font-semibold text-ink/75">
                    {m.isMine ? "You" : (m.authorName ?? "Someone")}
                  </span>{" "}
                  · {when(m.createdAt)}
                </p>
              )}
              <div
                className={`mt-1 whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.isMine
                    ? "bg-forest text-white"
                    : "border border-ink/10 bg-white text-ink"
                }`}
              >
                {m.body}
              </div>
            </div>
          </li>
        ))}
        <div ref={endRef} />
      </ol>

      <form onSubmit={send} className="sticky bottom-0 mt-4 bg-cream pb-4 pt-2">
        <div className="rounded-xl border border-ink/10 bg-white p-2">
          <label htmlFor="message-body" className="sr-only">
            Write a message
          </label>
          <textarea
            id="message-body"
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter breaks the line — texting behaviour.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(e as unknown as React.FormEvent);
              }
            }}
            placeholder="Message…"
            className="w-full resize-none rounded-md p-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-forest"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy || !body.trim()}
              className="h-9 rounded-md bg-forest px-4 text-sm font-semibold text-white hover:bg-forest/90 disabled:opacity-40"
            >
              {busy ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
