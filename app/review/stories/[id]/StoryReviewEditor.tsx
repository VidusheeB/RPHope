"use client";

import { useState } from "react";
import { saveStoryEdits, sendForApproval, publishStory, rejectStory } from "../actions";

type StoryRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  contact_method: string;
  consent_to_publish: boolean;
  edit_permission: "review_first" | "free_edit";
  display_name: string;
  display_contact: string;
  gene_slug: string | null;
  story_text: string;
  story_text_raw: string | null;
  video_path: string | null;
  status: "pending_review" | "published" | "rejected";
  approval_token: string | null;
  final_story_sent_at: string | null;
  published_at: string | null;
  created_at: string;
};

export default function StoryReviewEditor({
  story,
  videoUrl,
  canPublish,
}: {
  story: StoryRow;
  videoUrl: string | null;
  canPublish: boolean;
}) {
  const [text, setText] = useState(story.story_text);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const dirty = text !== story.story_text;

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const res = await saveStoryEdits(story.id, text);
    setSaving(false);
    setMessage(res.ok ? "Saved." : res.error);
  }

  async function handleSendForApproval() {
    setBusy("approval");
    setMessage(null);
    const res = await sendForApproval(story.id);
    setBusy(null);
    setMessage(res.ok ? "Sent to the submitter for approval." : res.error);
  }

  async function handlePublish() {
    setBusy("publish");
    setMessage(null);
    const res = await publishStory(story.id);
    setBusy(null);
    setMessage(res.ok ? "Published." : res.error);
  }

  async function handleReject() {
    setBusy("reject");
    setMessage(null);
    const res = await rejectStory(story.id, rejectNote || undefined);
    setBusy(null);
    setMessage(res.ok ? "Declined." : res.error);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-medium text-forest">{story.display_name}</h1>
        <p className="mt-1 text-sm text-ink/60">
          Submitted {new Date(story.created_at).toLocaleString()} · status: {story.status}
        </p>
      </div>

      <section className="rounded-lg border border-ink/10 bg-white p-5">
        <h2 className="font-display text-lg font-bold text-ink">Private info (not published)</h2>
        <dl className="mt-3 space-y-1 text-sm">
          <Row label="Full name" value={story.full_name} />
          <Row label="Email" value={story.email} />
          <Row label="Phone" value={story.phone || "—"} />
          <Row label="Preferred contact" value={story.contact_method} />
          <Row
            label="Edit permission"
            value={story.edit_permission === "free_edit" ? "Free edit (publish directly)" : "Review first (send for approval)"}
          />
          <Row label="Public display name" value={story.display_name} />
          <Row label="Public contact shown" value={story.display_contact} />
          {story.gene_slug && <Row label="Gene" value={story.gene_slug} />}
        </dl>
      </section>

      {videoUrl && (
        <section>
          <h2 className="font-display text-lg font-bold text-ink">Submitted video</h2>
          <video controls src={videoUrl} className="mt-3 w-full rounded-lg border border-ink/10" />
        </section>
      )}

      <section>
        <label htmlFor="review-story-text" className="font-display text-lg font-bold text-ink">
          Story text
        </label>
        <textarea
          id="review-story-text"
          rows={14}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="mt-3 w-full rounded-md border border-ink/25 bg-white px-4 py-3 text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-gold"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="rounded-md bg-forest px-5 py-2.5 font-bold text-white enabled:hover:bg-forest-dark disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save edits"}
          </button>
          {story.story_text_raw && (
            <details className="text-sm text-ink/60">
              <summary className="cursor-pointer">View pre-synthesis original</summary>
              <p className="mt-2 whitespace-pre-wrap rounded-md bg-cream-header p-3">{story.story_text_raw}</p>
            </details>
          )}
        </div>
      </section>

      {message && <p className="text-ink/80">{message}</p>}

      {story.status === "pending_review" && (
        <section className="flex flex-wrap items-center gap-3 border-t border-ink/10 pt-6">
          {story.edit_permission === "review_first" ? (
            <button
              type="button"
              onClick={handleSendForApproval}
              disabled={busy !== null}
              className="rounded-md bg-forest px-5 py-2.5 font-bold text-white enabled:hover:bg-forest-dark disabled:opacity-40"
            >
              {busy === "approval" ? "Sending…" : "Send for submitter approval"}
            </button>
          ) : canPublish ? (
            <button
              type="button"
              onClick={handlePublish}
              disabled={busy !== null}
              className="rounded-md bg-forest px-5 py-2.5 font-bold text-white enabled:hover:bg-forest-dark disabled:opacity-40"
            >
              {busy === "publish" ? "Publishing…" : "Publish"}
            </button>
          ) : (
            <p className="text-sm text-ink/60">
              This submitter granted free-edit permission, but you don&rsquo;t have publish
              access — ask an admin to publish.
            </p>
          )}

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Reason (optional)"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              className="rounded-md border border-ink/25 bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleReject}
              disabled={busy !== null}
              className="rounded-md border border-maroon/40 px-5 py-2.5 font-semibold text-maroon enabled:hover:bg-maroon/5 disabled:opacity-40"
            >
              {busy === "reject" ? "Declining…" : "Decline"}
            </button>
          </div>
        </section>
      )}

      {story.status === "pending_review" &&
        story.edit_permission === "review_first" &&
        story.final_story_sent_at &&
        canPublish && (
          <div className="border-t border-ink/10 pt-6">
            <button
              type="button"
              onClick={handlePublish}
              disabled={busy !== null}
              className="rounded-md bg-forest px-5 py-2.5 font-bold text-white enabled:hover:bg-forest-dark disabled:opacity-40"
            >
              {busy === "publish" ? "Publishing…" : "Submitter approved — publish now"}
            </button>
          </div>
        )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink/55">{label}</dt>
      <dd className="text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}
