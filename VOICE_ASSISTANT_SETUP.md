# RP Hope Voice Assistant — Setup

A hands-free, ChatGPT-Voice-style guide grounded in RP Hope's reviewed website
content. It uses OpenAI's Realtime API (speech-to-speech over WebRTC) with a
server-side `gpt-5.4` reasoner for harder questions. The only thing you need to
turn it on is **one environment variable**.

## 1. Add `OPENAI_API_KEY` locally

1. Create/open `.env.local` in the project root (it is gitignored).
2. Add:
   ```
   OPENAI_API_KEY=sk-...your key...
   ```
   Get a key at <https://platform.openai.com> → API keys. This is a **server-only**
   secret — do **not** give it a `NEXT_PUBLIC_` prefix and never paste it into
   client code.
3. Restart the dev server so it picks up the key.

`.env.example` documents this variable.

## 2. Add it in Vercel (production)

Project → **Settings → Environment Variables** → add `OPENAI_API_KEY` for
**Production** (and Preview). Redeploy. The key stays on the server; the browser
only ever receives a short-lived ephemeral token (`ek_...`) minted per session by
`/api/openai/realtime-token`.

## 3. Run the project

```bash
npm install
npm run dev            # http://localhost:3000
```

Other useful commands:

```bash
npm run lint
npm run typecheck
npm test               # Vitest
npm run build
```

## 4. Test microphone access

1. Open the site and click **“Talk to RP Hope”** (bottom-right).
2. Click **Start conversation**. The browser will ask for microphone permission —
   allow it. (The mic is **never** activated automatically.)
3. You should hear a short greeting, then speak naturally. Try: *“What can you tell
   me about RPGR?”*, *“Read this page to me,”* *“Take me to clinical trials,”*
   *“Stop.”*
4. If the mic is blocked, the panel explains how to re-enable it and lets you
   **type** instead. Works best in Chrome/Edge/Safari (needs WebRTC).

## 5. Where the instructions and knowledge live

- **Agent personality / rules:** `lib/voice/agentInstructions.ts` (edit the prose;
  the next session uses it).
- **Knowledge records:** `lib/knowledge/records.ts` (built from gene data,
  sections, articles, and a small curated set). Search lives in
  `lib/knowledge/search.ts`; synonyms in `lib/knowledge/synonyms.ts`.
- **Tools:** `lib/voice/tools.ts`. **Navigation allowlist:**
  `lib/voice/navigationRegistry.ts`. **Session/model config:** `lib/voice/agent.ts`.
- **Server reasoning:** `app/api/openai/rp-expert/route.ts` (`gpt-5.4`).
- **UI:** `components/site/voice-assistant/*`, hook in
  `hooks/useRPVoiceAssistant.ts`.

## 6. Adding or updating reviewed RP Hope content

The assistant only speaks **reviewed** content. To add or correct what it knows:

- **Genes:** edit `lib/genesData.json` (records with a `summary` are indexed).
- **Sections / pages:** edit `lib/navTargets.ts`.
- **Articles:** `lib/articlesIndex.json`.
- **Org / FAQ / genetic-testing answers:** the `curated` array in
  `lib/knowledge/records.ts`. Only add content that a human has reviewed —
  `reviewStatus: "reviewed"`. Draft/unpublished content is excluded by design.

No rebuild step is required beyond a normal deploy; the index builds at module
load from these sources.

## 7. Privacy, accessibility, and medical boundaries

- **Privacy:** the transcript is kept **in memory only** — never written to
  localStorage, never sent to analytics, and questions/gene names/tool inputs are
  **not logged**. Conversation state is cleared when the session ends. Server
  errors are sanitized before returning.
- **Accessibility (WCAG 2.2 AA intent):** full keyboard operation, visible focus,
  captions for every spoken response, a complete text-input alternative, 44px+
  targets, ARIA live announcements for connection/navigation, focus restoration
  on close, high-contrast and reduced-motion preferences, and no autoplay before
  a user gesture. State is conveyed by text + icon, not color alone.
- **Medical boundary:** the assistant does not diagnose, prescribe, or guarantee
  trial eligibility. It explains reviewed information, suggests questions for a
  clinician/genetic counselor, and frames trials as options to review. Website
  content is treated as reference material, never as instructions to the model
  (prompt-injection guard).

## 8. Known limitations

- **Requires a modern browser with WebRTC** (Chrome, Edge, Safari). Firefox voice
  support is limited; those users can type in the panel.
- **The rate limiter is prototype-grade** (in-memory, per server instance) — good
  enough to blunt obvious abuse, but not a substitute for a shared/edge limiter at
  scale.
- **The knowledge index is keyword/fuzzy (MiniSearch)**, not embeddings. It's fast
  and dependency-free and fits the current site size; a future upgrade could add
  semantic (pgvector) retrieval if the library grows large.
- **Cost:** Realtime audio and `gpt-5.4` reasoning are paid per use. This is a
  deliberate upgrade over the previous free browser-voice assistant.
- Once `OPENAI_API_KEY` is set and you grant microphone permission, the experience
  works with no further steps.
