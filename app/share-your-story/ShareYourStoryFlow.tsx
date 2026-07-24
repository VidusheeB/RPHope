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
import { setStoryFormBridge } from "@/lib/voice/storyFormBridge";
import type {
  ContactMethod,
  DisplayContact,
  EditPermission,
  StorySubmissionInput,
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
  audioPath: string;
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
  audioPath: "",
};

const inputClass =
  "w-full rounded-md border border-ink/25 bg-white px-4 py-3 text-ink placeholder:text-ink/50 focus:border-forest focus:outline-none focus:ring-2 focus:ring-gold";

// What's missing before Continue unlocks, spelled out rather than just
// silently disabling the button — the previous version left people stuck
// with no explanation (e.g. a hard, unstated 20-character story minimum).
function missingStep1(form: FormState): string[] {
  const missing: string[] = [];
  if (!form.fullName.trim()) missing.push("your name");
  if (!/\S+@\S+\.\S+/.test(form.email)) missing.push("a valid email");
  if (!form.contactMethod) missing.push("a contact preference");
  if (form.contactMethod === "phone" && !form.phone.trim()) missing.push("a phone number");
  if (!form.consentToPublish) missing.push("consent to publish");
  if (!form.editPermission) missing.push("an edit-permission choice");
  return missing;
}

function missingStep2(form: FormState): string[] {
  const missing: string[] = [];
  if (!form.displayName.trim()) missing.push("a display name");
  if (!form.displayContact) missing.push("whether to show contact info");
  if (form.displayContact === "phone" && !form.phone.trim()) missing.push("a phone number");
  if (!form.storyText.trim()) missing.push("your story");
  return missing;
}

function englishList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

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

  const step1Missing = missingStep1(form);
  const step2Missing = missingStep2(form);
  const canContinueStep1 = step1Missing.length === 0;
  const canContinueStep2 = step2Missing.length === 0;

  // The actual submission call, decoupled from `form` state — takes an
  // explicit payload so it behaves identically whether it's called from the
  // manual Submit button (payload built from current `form`) or from the
  // voice assistant's visible replay below (payload built from what the
  // assistant already confirmed by voice, independent of whatever the
  // on-screen fields happen to show at that exact instant).
  async function submitPayload(payload: StorySubmissionInput): Promise<{ ok: boolean; error?: string }> {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/stories/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setSubmitError(message);
      return { ok: false, error: message };
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit() {
    await submitPayload({
      fullName: form.fullName,
      email: form.email,
      phone: form.phone || undefined,
      contactMethod: form.contactMethod as ContactMethod,
      consentToPublish: form.consentToPublish,
      editPermission: form.editPermission as EditPermission,
      displayName: form.displayName,
      displayContact: form.displayContact as DisplayContact,
      geneSlug: form.geneSlug || undefined,
      storyText: form.storyText,
      storyTextRaw: form.storyTextRaw || undefined,
      videoPath: form.videoPath || undefined,
      audioPath: form.audioPath || undefined,
    });
  }

  // Registered once (below) for the voice assistant's submit_story tool.
  // Visibly fills the REAL form — field by field, paced so it's actually
  // perceptible on screen — advances through its steps, and submits
  // through the same submitPayload() the manual button uses, so the user
  // ends up on the real Thank You screen, not just a spoken confirmation.
  async function fillAndSubmit(data: StorySubmissionInput): Promise<{ ok: boolean; error?: string }> {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    setStep(1);
    await wait(700);
    update("fullName", data.fullName);
    await wait(350);
    update("email", data.email);
    await wait(350);
    if (data.phone) {
      update("phone", data.phone);
      await wait(300);
    }
    update("contactMethod", data.contactMethod);
    await wait(300);
    update("consentToPublish", data.consentToPublish);
    await wait(300);
    update("editPermission", data.editPermission);
    await wait(700);

    setStep(2);
    await wait(700);
    update("displayName", data.displayName);
    await wait(350);
    update("displayContact", data.displayContact);
    await wait(350);
    if (data.geneSlug) {
      update("geneSlug", data.geneSlug);
      await wait(300);
    }
    update("storyText", data.storyText);
    await wait(700);

    setStep(3);
    await wait(1200);

    return submitPayload(data);
  }

  // The bridge's behavior never actually depends on which render created
  // it (every function above closes only over stable setState references,
  // not over `form` itself), so registering it once on mount is safe.
  useEffect(() => {
    setStoryFormBridge({ fillAndSubmit });
    return () => setStoryFormBridge(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      {step === 1 && !canContinueStep1 && (
        <p className="mt-4 text-right text-sm text-ink/55">
          Add {englishList(step1Missing)} to continue.
        </p>
      )}
      {step === 2 && !canContinueStep2 && (
        <p className="mt-4 text-right text-sm text-ink/55">
          Add {englishList(step2Missing)} to continue.
        </p>
      )}

      <div className="mt-4 flex items-center justify-between">
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
            externalHref={example.href}
            source={example.source}
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

type AudioStage = "idle" | "recording" | "reviewing" | "processing" | "attached";

function PublicContentStep({
  form,
  update,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  const [audioStage, setAudioStage] = useState<AudioStage>("idle");
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoFileName, setVideoFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [listening, setListening] = useState(false);
  const [ttsAvailable, setTtsAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    isTTSAvailable().then((ok) => {
      if (!cancelled) setTtsAvailable(ok);
    });
    return () => {
      cancelled = true;
      cancelSpeech();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        setAudioStage("reviewing");
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setAudioStage("recording");
    } catch {
      setError("Couldn't access your microphone. Check your browser permissions, or just type your story.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  function discardRecording() {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setRecordedBlob(null);
    setAudioStage("idle");
  }

  async function useRecording() {
    if (!recordedBlob) return;
    setError(null);
    setAudioStage("processing");
    try {
      const prep = await fetch("/api/stories/upload-audio", { method: "POST" });
      if (!prep.ok) throw new Error("Couldn't prepare the upload.");
      const { path, token } = await prep.json();

      const supabase = getBrowserSupabase();
      const { error: uploadErr } = await supabase.storage
        .from("story-videos")
        .uploadToSignedUrl(path, token, recordedBlob);
      if (uploadErr) throw uploadErr;
      update("audioPath", path);

      setTranscribing(true);
      const body = new FormData();
      body.append("audio", recordedBlob, "story.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body });
      if (res.ok) {
        const data = await res.json();
        appendStoryText(data.text || "");
      }
      setAudioStage("attached");
    } catch {
      setError("Couldn't save that recording. You can try again, or just type your story.");
      setAudioStage("reviewing");
    } finally {
      setTranscribing(false);
    }
  }

  function removeAttachedRecording() {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setRecordedBlob(null);
    update("audioPath", "");
    setAudioStage("idle");
  }

  async function handleVideoSelected(file: File) {
    setError(null);
    setUploadingVideo(true);
    setVideoFileName(file.name);
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
      setVideoFileName(null);
    } finally {
      setUploadingVideo(false);
    }
  }

  function removeVideo() {
    update("videoPath", "");
    setVideoFileName(null);
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
      </div>

      <div>
        <p className="font-semibold text-ink">Record your story instead (optional)</p>
        <p className="mt-1 text-sm text-ink/60">
          Speak it out loud — you can listen back and download it before deciding to use it.
        </p>

        {audioStage === "idle" && (
          <button
            type="button"
            onClick={startRecording}
            className="mt-3 rounded-md border border-ink/25 bg-white px-4 py-2.5 font-semibold text-ink hover:border-forest/40"
          >
            🎤 Start recording
          </button>
        )}

        {audioStage === "recording" && (
          <button
            type="button"
            onClick={stopRecording}
            className="mt-3 rounded-md border border-maroon/40 bg-white px-4 py-2.5 font-semibold text-maroon hover:bg-maroon/5"
          >
            ⏹ Stop recording
          </button>
        )}

        {(audioStage === "reviewing" || audioStage === "processing") && recordedUrl && (
          <div className="mt-3 space-y-3 rounded-lg border border-ink/15 bg-white p-4">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio controls src={recordedUrl} className="w-full" />
            <div className="flex flex-wrap items-center gap-4">
              <a
                href={recordedUrl}
                download="my-story-recording.webm"
                className="text-sm font-semibold text-forest underline"
              >
                Download recording
              </a>
              <button
                type="button"
                onClick={useRecording}
                disabled={audioStage === "processing"}
                className="rounded-md bg-forest px-4 py-2 text-sm font-bold text-white enabled:hover:bg-forest-dark disabled:opacity-50"
              >
                {audioStage === "processing"
                  ? transcribing
                    ? "Transcribing…"
                    : "Saving…"
                  : "Use this recording"}
              </button>
              <button
                type="button"
                onClick={discardRecording}
                disabled={audioStage === "processing"}
                className="rounded-md border border-ink/25 px-4 py-2 text-sm font-semibold text-ink hover:border-forest/40 disabled:opacity-50"
              >
                Discard &amp; re-record
              </button>
            </div>
          </div>
        )}

        {audioStage === "attached" && recordedUrl && (
          <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg border border-forest/30 bg-forest/5 p-4">
            <span className="font-semibold text-forest">✓ Recording attached</span>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio controls src={recordedUrl} className="max-w-xs" />
            <a
              href={recordedUrl}
              download="my-story-recording.webm"
              className="text-sm font-semibold text-forest underline"
            >
              Download
            </a>
            <button
              type="button"
              onClick={removeAttachedRecording}
              className="text-sm font-semibold text-maroon underline"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      <div>
        <p className="font-semibold text-ink">Or upload a video instead (optional, 3–5 min)</p>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleVideoSelected(file);
          }}
          onClick={() => videoInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              videoInputRef.current?.click();
            }
          }}
          className={`mt-3 cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
            dragOver ? "border-forest bg-forest/5" : "border-ink/25 bg-white hover:border-forest/40"
          }`}
        >
          {uploadingVideo ? (
            <p className="text-ink/70">Uploading {videoFileName}…</p>
          ) : videoFileName && form.videoPath ? (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="font-semibold text-forest">✓ {videoFileName} attached</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeVideo();
                }}
                className="text-sm font-semibold text-maroon underline"
              >
                Remove
              </button>
            </div>
          ) : (
            <p className="text-ink/70">📹 Click to upload, or drag and drop a video here</p>
          )}
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleVideoSelected(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <p className="text-sm text-ink/55">
        Recording or uploading fills in the story text above automatically —
        it&rsquo;s always editable afterward.
      </p>
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
