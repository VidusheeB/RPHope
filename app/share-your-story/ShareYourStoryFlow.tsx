"use client";

// "Share your story" — a 4-step flow (how it works → private info → public
// content & story input → review) modeled directly on app/my-pathway's
// MyPathway.tsx: step/answers-object/mounted state, gated dual-useEffect
// sessionStorage save/restore (text fields only — audio/video blobs are
// never persisted, they live only in memory and are lost on a hard refresh).

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { geneGrid } from "@/lib/geneGrid";
import { curatedStories } from "@/lib/curatedStories";
import StoryCard, { excerptOf } from "@/components/site/StoryCard";
import { wordCountHint } from "@/lib/stories/validation";
import { speak, cancelSpeech, isTTSAvailable } from "@/lib/speech";
import { getBrowserSupabase } from "@/lib/supabaseBrowser";
import type {
  ContactMethod,
  DisplayContact,
  EditPermission,
} from "@/lib/stories/types";

const STORAGE_KEY = "rphope_share_story";

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  contactMethod: ContactMethod | "";
  consentToPublish: boolean;
  editPermission: EditPermission | "";
  displayName: string;
  displayContact: DisplayContact | "";
  geneSlug: string;
  storyText: string;
  storyTextRaw: string;
  videoPath: string;
};

const emptyForm: FormState = {
  fullName: "",
  email: "",
  phone: "",
  contactMethod: "",
  consentToPublish: false,
  editPermission: "",
  displayName: "",
  displayContact: "",
  geneSlug: "",
  storyText: "",
  storyTextRaw: "",
  videoPath: "",
};

const inputClass =
  "w-full rounded-md border border-ink/25 bg-white px-4 py-3 text-ink placeholder:text-ink/50 focus:border-forest focus:outline-none focus:ring-2 focus:ring-gold";

export default function ShareYourStoryFlow() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [mounted, setMounted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Restore in-progress answers once, after hydration.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { form?: FormState; step?: number };
        if (saved.form) setForm({ ...emptyForm, ...saved.form });
        if (typeof saved.step === "number") setStep(saved.step);
      }
    } catch {
      /* storage unavailable — form still works, just no restore */
    }
    setMounted(true);
  }, []);

  // Persist on change (skip until after the restore pass).
  useEffect(() => {
    if (!mounted || submitted) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ form, step }));
    } catch {
      /* ignore */
    }
  }, [form, step, mounted, submitted]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const canContinueStep1 =
    form.fullName.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(form.email) &&
    form.contactMethod !== "" &&
    (form.contactMethod !== "phone" || form.phone.trim().length > 0) &&
    form.consentToPublish &&
    form.editPermission !== "";

  const canContinueStep2 =
    form.displayName.trim().length > 0 &&
    form.displayContact !== "" &&
    (form.displayContact !== "phone" || form.phone.trim().length > 0) &&
    form.storyText.trim().length >= 20;

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/stories/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          phone: form.phone || undefined,
          contactMethod: form.contactMethod,
          consentToPublish: form.consentToPublish,
          editPermission: form.editPermission,
          displayName: form.displayName,
          displayContact: form.displayContact,
          geneSlug: form.geneSlug || undefined,
          storyText: form.storyText,
          storyTextRaw: form.storyTextRaw || undefined,
          videoPath: form.videoPath || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Something went wrong. Please try again.");
      }
      setSubmitted(true);
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) return <ThankYou />;

  return (
    <div>
      <p className="text-sm font-bold uppercase tracking-widest text-forest">
        Share Your Story
      </p>
      <h1 className="mt-3 font-display text-3xl font-medium tracking-tight text-ink sm:text-4xl">
        {step === 0 && "How this works"}
        {step === 1 && "About you"}
        {step === 2 && "Your story"}
        {step === 3 && "Review & submit"}
      </h1>

      <div className="mt-8" aria-hidden="true">
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-forest" : "bg-ink/15"}`}
            />
          ))}
        </div>
      </div>

      {step === 0 && <IntroStep />}
      {step === 1 && <PrivateInfoStep form={form} update={update} />}
      {step === 2 && <PublicContentStep form={form} update={update} />}
      {step === 3 && (
        <ReviewStep form={form} error={submitError} submitting={submitting} />
      )}

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="rounded-md px-5 py-3 font-semibold text-ink/70 enabled:hover:bg-ink/5 disabled:opacity-40"
        >
          ← Back
        </button>
        {step < 3 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={(step === 1 && !canContinueStep1) || (step === 2 && !canContinueStep2)}
            className="rounded-md bg-forest px-7 py-3 font-bold text-white enabled:hover:bg-forest-dark disabled:opacity-40"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-md bg-forest px-7 py-3 font-bold text-white enabled:hover:bg-forest-dark disabled:opacity-40"
          >
            {submitting ? "Submitting…" : "Submit story"}
          </button>
        )}
      </div>
    </div>
  );
}

// ---- Step 0: How this works ------------------------------------------------

function IntroStep() {
  const example = curatedStories.find((s) => s.name === "Rosie") ?? curatedStories[0];
  return (
    <div className="mt-6 space-y-6 text-ink/80">
      <p className="text-lg leading-relaxed">
        RP looks different for everyone, and the community learns from every
        story shared. Here&rsquo;s what happens after you submit yours:
      </p>
      <ol className="space-y-3 text-lg leading-relaxed">
        <li>
          <strong className="text-ink">1. You submit.</strong> Type your
          story, dictate it by voice, or upload a short video.
        </li>
        <li>
          <strong className="text-ink">2. We review.</strong> A reviewer
          reads it over and makes light edits for clarity if needed.
        </li>
        <li>
          <strong className="text-ink">3. You&rsquo;re in control.</strong>{" "}
          If you asked to review the final version, we&rsquo;ll send it to
          you to approve before it goes live. If you gave us permission to
          edit freely, we&rsquo;ll publish once it&rsquo;s ready.
        </li>
        <li>
          <strong className="text-ink">4. It goes live.</strong> We&rsquo;ll
          follow up within about 10 business days either way.
        </li>
      </ol>

      <div>
        <p className="mb-3 text-sm font-bold uppercase tracking-widest text-forest">
          Example — styled the way your published story would look
        </p>
        <div className="max-w-sm">
          <StoryCard
            name={example.name}
            excerpt={example.blurb}
            tag={example.tag}
          />
        </div>
      </div>
    </div>
  );
}

// ---- Step 1: Private info ---------------------------------------------------

function PrivateInfoStep({
  form,
  update,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="story-name" className="block font-semibold text-ink">
            Full name
          </label>
          <input
            id="story-name"
            type="text"
            required
            autoComplete="name"
            value={form.fullName}
            onChange={(e) => update("fullName", e.target.value)}
            className={`mt-1.5 ${inputClass}`}
          />
        </div>
        <div>
          <label htmlFor="story-email" className="block font-semibold text-ink">
            Email
          </label>
          <input
            id="story-email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className={`mt-1.5 ${inputClass}`}
          />
        </div>
      </div>

      <fieldset>
        <legend className="font-semibold text-ink">
          How should we contact you?
        </legend>
        <div className="mt-2 flex gap-3">
          {(["email", "phone"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => update("contactMethod", m)}
              aria-pressed={form.contactMethod === m}
              className={`rounded-md border px-5 py-2.5 font-semibold capitalize transition ${
                form.contactMethod === m
                  ? "border-forest bg-forest/5 text-forest"
                  : "border-ink/20 bg-white text-ink hover:border-forest/40"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="story-phone" className="block font-semibold text-ink">
          Phone{form.contactMethod === "phone" ? "" : " (optional)"}
        </label>
        <input
          id="story-phone"
          type="tel"
          autoComplete="tel"
          required={form.contactMethod === "phone"}
          value={form.phone}
          onChange={(e) => update("phone", e.target.value)}
          className={`mt-1.5 ${inputClass}`}
        />
      </div>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={form.consentToPublish}
          onChange={(e) => update("consentToPublish", e.target.checked)}
          className="mt-1 h-5 w-5 rounded border-ink/30 text-forest focus:ring-gold"
        />
        <span className="text-ink">
          I consent to my story being published on the RP Hope website.{" "}
          <span aria-hidden="true" className="text-maroon">*</span>
        </span>
      </label>

      <fieldset>
        <legend className="font-semibold text-ink">
          Can we make light edits (grammar, length) to your story?
        </legend>
        <div className="mt-2 space-y-2">
          <label className="flex items-start gap-3">
            <input
              type="radio"
              name="editPermission"
              checked={form.editPermission === "review_first"}
              onChange={() => update("editPermission", "review_first")}
              className="mt-1 h-5 w-5 border-ink/30 text-forest focus:ring-gold"
            />
            <span className="text-ink">
              Yes, but send me the final version to approve before it&rsquo;s
              published.
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input
              type="radio"
              name="editPermission"
              checked={form.editPermission === "free_edit"}
              onChange={() => update("editPermission", "free_edit")}
              className="mt-1 h-5 w-5 border-ink/30 text-forest focus:ring-gold"
            />
            <span className="text-ink">
              Yes, I trust RP Hope to edit and publish without checking back
              with me first.
            </span>
          </label>
        </div>
      </fieldset>

      <p className="text-sm text-ink/60">
        <span aria-hidden="true" className="text-maroon">*</span> We&rsquo;ll
        contact you using the info above, so please double-check it. We&rsquo;ll
        follow up within about 10 business days.
      </p>
    </div>
  );
}

// ---- Step 2: Public content + story input ----------------------------------

function PublicContentStep({
  form,
  update,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [listening, setListening] = useState(false);
  const [ttsAvailable, setTtsAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    let cancelled = false;
    isTTSAvailable().then((ok) => {
      if (!cancelled) setTtsAvailable(ok);
    });
    return () => {
      cancelled = true;
      cancelSpeech();
    };
  }, []);

  function appendStoryText(text: string) {
    if (!text.trim()) return;
    update(
      "storyText",
      form.storyText.trim() ? `${form.storyText.trim()}\n\n${text.trim()}` : text.trim()
    );
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setTranscribing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const body = new FormData();
          body.append("audio", blob, "story.webm");
          const res = await fetch("/api/transcribe", { method: "POST", body });
          if (!res.ok) throw new Error("Transcription failed.");
          const data = await res.json();
          appendStoryText(data.text || "");
        } catch {
          setError("Couldn't transcribe that recording. You can still type your story.");
        } finally {
          setTranscribing(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError("Couldn't access your microphone. Check your browser permissions, or just type your story.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function handleVideoSelected(file: File) {
    setError(null);
    setUploadingVideo(true);
    try {
      const prep = await fetch("/api/stories/upload-video", { method: "POST" });
      if (!prep.ok) throw new Error("Couldn't prepare the upload.");
      const { path, token } = await prep.json();

      const supabase = getBrowserSupabase();
      const { error: uploadErr } = await supabase.storage
        .from("story-videos")
        .uploadToSignedUrl(path, token, file);
      if (uploadErr) throw uploadErr;

      update("videoPath", path);
      setTranscribing(true);
      try {
        const res = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoPath: path }),
        });
        if (res.ok) {
          const data = await res.json();
          appendStoryText(data.text || "");
        }
      } finally {
        setTranscribing(false);
      }
    } catch {
      setError("Couldn't upload that video. You can still type or dictate your story.");
    } finally {
      setUploadingVideo(false);
    }
  }

  async function handleSynthesize() {
    if (!form.storyText.trim()) return;
    setError(null);
    setSynthesizing(true);
    try {
      const res = await fetch("/api/stories/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: form.storyText }),
      });
      if (!res.ok) throw new Error("Synthesis failed.");
      const data = await res.json();
      if (!form.storyTextRaw) update("storyTextRaw", form.storyText);
      update("storyText", data.synthesized || form.storyText);
    } catch {
      setError("Couldn't clean up your draft right now. Your original text is unchanged.");
    } finally {
      setSynthesizing(false);
    }
  }

  function handleListen() {
    if (listening) {
      cancelSpeech();
      setListening(false);
      return;
    }
    setListening(true);
    speak(form.storyText, {
      onEnd: () => setListening(false),
      onError: () => setListening(false),
    });
  }

  return (
    <div className="mt-6 space-y-6">
      <div>
        <label htmlFor="story-display-name" className="block font-semibold text-ink">
          Name to display
        </label>
        <input
          id="story-display-name"
          type="text"
          required
          placeholder='e.g. "Jamie" or "Anonymous"'
          value={form.displayName}
          onChange={(e) => update("displayName", e.target.value)}
          className={`mt-1.5 ${inputClass}`}
        />
        <p className="mt-1.5 text-sm text-ink/60">
          Prefer not to use your name? Type &ldquo;Anonymous.&rdquo;
        </p>
      </div>

      <fieldset>
        <legend className="font-semibold text-ink">
          Show contact info with your story?
        </legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {(["email", "phone", "none"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => update("displayContact", opt)}
              aria-pressed={form.displayContact === opt}
              className={`rounded-md border px-5 py-2.5 font-semibold capitalize transition ${
                form.displayContact === opt
                  ? "border-forest bg-forest/5 text-forest"
                  : "border-ink/20 bg-white text-ink hover:border-forest/40"
              }`}
            >
              {opt === "none" ? "No" : opt}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="story-gene" className="block font-semibold text-ink">
          Your gene (optional)
        </label>
        <input
          id="story-gene"
          type="text"
          list="story-gene-list"
          placeholder="e.g. RPGR, USH2A, PDE6B"
          autoComplete="off"
          value={form.geneSlug}
          onChange={(e) => update("geneSlug", e.target.value)}
          className={`mt-1.5 ${inputClass}`}
        />
        <datalist id="story-gene-list">
          {geneGrid.map((g) => (
            <option key={g.slug} value={g.display} />
          ))}
        </datalist>
      </div>

      <div>
        <label htmlFor="story-text" className="block font-semibold text-ink">
          Your story
        </label>
        <textarea
          id="story-text"
          rows={10}
          required
          placeholder="Tell your story in your own words…"
          value={form.storyText}
          onChange={(e) => update("storyText", e.target.value)}
          className={`mt-1.5 ${inputClass}`}
        />
        <p className="mt-1.5 text-sm text-ink/60">{wordCountHint(form.storyText)}</p>

        {error && <p className="mt-2 text-sm text-maroon">{error}</p>}

        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={transcribing}
            className="rounded-md border border-ink/25 bg-white px-4 py-2.5 font-semibold text-ink hover:border-forest/40 disabled:opacity-50"
          >
            {recording ? "⏹ Stop recording" : transcribing ? "Transcribing…" : "🎤 Record my story"}
          </button>

          <label className="inline-flex cursor-pointer items-center rounded-md border border-ink/25 bg-white px-4 py-2.5 font-semibold text-ink hover:border-forest/40">
            {uploadingVideo ? "Uploading…" : "📹 Upload a video (3–5 min)"}
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="sr-only"
              disabled={uploadingVideo}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleVideoSelected(file);
                e.target.value = "";
              }}
            />
          </label>

          <button
            type="button"
            onClick={handleSynthesize}
            disabled={synthesizing || !form.storyText.trim()}
            className="rounded-md border border-ink/25 bg-white px-4 py-2.5 font-semibold text-ink hover:border-forest/40 disabled:opacity-50"
          >
            {synthesizing ? "Cleaning up…" : "✨ Synthesize"}
          </button>

          {ttsAvailable && (
            <button
              type="button"
              onClick={handleListen}
              disabled={!form.storyText.trim()}
              className="rounded-md border border-ink/25 bg-white px-4 py-2.5 font-semibold text-ink hover:border-forest/40 disabled:opacity-50"
            >
              {listening ? "⏸ Stop listening" : "🔊 Listen to my story"}
            </button>
          )}
        </div>
        <p className="mt-2 text-sm text-ink/55">
          Recording or uploading fills in the text above — it&rsquo;s always
          editable afterward.
        </p>
      </div>
    </div>
  );
}

// ---- Step 3: Review ---------------------------------------------------------

function ReviewStep({
  form,
  error,
  submitting,
}: {
  form: FormState;
  error: string | null;
  submitting: boolean;
}) {
  return (
    <div className="mt-6 space-y-6">
      <dl className="space-y-3 rounded-lg border border-ink/10 bg-white p-5">
        <Row label="Name" value={form.fullName} />
        <Row label="Contact" value={`${form.email}${form.phone ? ` · ${form.phone}` : ""}`} />
        <Row
          label="Edit permission"
          value={
            form.editPermission === "free_edit"
              ? "RP Hope may edit and publish freely"
              : "Send me the final version to approve"
          }
        />
        <Row label="Display name" value={form.displayName} />
        <Row
          label="Public contact"
          value={form.displayContact === "none" ? "Not shown" : form.displayContact}
        />
        {form.geneSlug && <Row label="Gene" value={form.geneSlug} />}
      </dl>

      <div>
        <p className="font-semibold text-ink">Your story</p>
        <p className="mt-2 whitespace-pre-wrap rounded-lg border border-ink/10 bg-white p-5 text-ink/80">
          {excerptOf(form.storyText, 1200)}
        </p>
      </div>

      {error && <p className="text-maroon">{error}</p>}
      {submitting && <p className="text-ink/60">Submitting your story…</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink/60">{label}</dt>
      <dd className="text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}

// ---- Post-submit -------------------------------------------------------------

function ThankYou() {
  return (
    <div className="text-center">
      <div
        aria-hidden="true"
        className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-forest text-white"
      >
        <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <h1 className="mt-6 font-display text-4xl font-medium tracking-tight text-ink">
        Thank you for sharing your story
      </h1>
      <p className="mt-4 text-lg text-ink/75">
        A reviewer will read it over, and we&rsquo;ll follow up within about 10
        business days — either with your story ready to approve, or once
        it&rsquo;s published.
      </p>
      <p className="mt-4 text-ink/70">
        Questions in the meantime? Reach us at{" "}
        <a
          className="font-semibold text-forest underline hover:text-forest-dark"
          href="mailto:information@rphope.org"
        >
          information@rphope.org
        </a>
        .
      </p>
      <Link
        href="/stories"
        className="mt-8 inline-block rounded-md bg-forest px-6 py-3 font-bold text-white hover:bg-forest-dark"
      >
        Back to Stories
      </Link>
    </div>
  );
}
