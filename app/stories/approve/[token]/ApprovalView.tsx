"use client";

import { useState } from "react";
import { approveStory, requestChanges } from "./actions";

export default function ApprovalView({
  token,
  fullName,
  storyText,
  alreadyResponded,
}: {
  token: string;
  fullName: string;
  storyText: string;
  alreadyResponded: boolean;
}) {
  const [done, setDone] = useState<"approved" | "changes" | null>(
    alreadyResponded ? "approved" : null
  );
  const [note, setNote] = useState("");
  const [showNoteBox, setShowNoteBox] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setBusy(true);
    setError(null);
    const res = await approveStory(token);
    setBusy(false);
    if (res.ok) setDone("approved");
    else setError(res.error);
  }

  async function handleRequestChanges() {
    setBusy(true);
    setError(null);
    const res = await requestChanges(token, note);
    setBusy(false);
    if (res.ok) setDone("changes");
    else setError(res.error);
  }

  if (done === "approved") {
    return (
      <div className="text-center">
        <h1 className="font-display text-3xl font-medium text-forest">
          Thanks, {alreadyResponded ? "your story is on its way to being published." : "your story is now published!"}
        </h1>
        <p className="mt-4 text-ink/75">
          Thank you for sharing it with the RP Hope community.
        </p>
      </div>
    );
  }
  if (done === "changes") {
    return (
      <div className="text-center">
        <h1 className="font-display text-3xl font-medium text-forest">
          Thanks — we&rsquo;ll follow up
        </h1>
        <p className="mt-4 text-ink/75">
          A reviewer will look at your note and get back to you at{" "}
          information@rphope.org.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-bold uppercase tracking-widest text-forest">
        Review your story
      </p>
      <h1 className="mt-3 font-display text-3xl font-medium tracking-tight text-ink">
        Hi {fullName}, here&rsquo;s the edited version
      </h1>
      <p className="mt-4 text-ink/75">
        Take a look below. If it looks good, approve it and it goes live
        right away. If something needs to change, let us know.
      </p>

      <p className="mt-8 whitespace-pre-wrap rounded-lg border border-ink/10 bg-white p-5 text-ink/80">
        {storyText}
      </p>

      {error && <p className="mt-4 text-maroon">{error}</p>}

      {showNoteBox ? (
        <div className="mt-6">
          <label htmlFor="changes-note" className="block font-semibold text-ink">
            What would you like changed?
          </label>
          <textarea
            id="changes-note"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-ink/25 bg-white px-4 py-3 text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-gold"
          />
          <button
            type="button"
            onClick={handleRequestChanges}
            disabled={busy || !note.trim()}
            className="mt-3 rounded-md bg-forest px-6 py-3 font-bold text-white enabled:hover:bg-forest-dark disabled:opacity-40"
          >
            {busy ? "Sending…" : "Send request"}
          </button>
        </div>
      ) : (
        <div className="mt-8 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={handleApprove}
            disabled={busy}
            className="rounded-md bg-forest px-6 py-3 font-bold text-white enabled:hover:bg-forest-dark disabled:opacity-40"
          >
            {busy ? "Publishing…" : "Approve — publish my story"}
          </button>
          <button
            type="button"
            onClick={() => setShowNoteBox(true)}
            disabled={busy}
            className="rounded-md border border-ink/25 bg-white px-6 py-3 font-semibold text-ink hover:border-forest/40"
          >
            Request changes
          </button>
        </div>
      )}
    </div>
  );
}
