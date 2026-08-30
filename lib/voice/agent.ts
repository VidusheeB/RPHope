// Factory for the RP Hope RealtimeAgent and the Realtime session configuration.
// The agent + config are shared by the client hook (which owns the live
// RealtimeSession over WebRTC).

import { RealtimeAgent, type RealtimeSessionConfig } from "@openai/agents/realtime";
import { ASSISTANT_INSTRUCTIONS } from "./agentInstructions";
import { rpHopeTools } from "./tools";

export const REALTIME_MODEL = "gpt-realtime-2.1";
export const REALTIME_VOICE = "marin";
export const TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";
export const WORKFLOW_NAME = "RP Hope Voice Assistant";

/** Spoken once, automatically, when a new session becomes ready. The user does
 *  not have to say anything first — pressing "Talk to Hope" is the
 *  explicit action, and this is the reply to it. */
export const HOPE_INTRODUCTION =
  "Hi, I'm Hope, RP Hope's AI voice guide. Ask me anything about this page. " +
  "You can mute me whenever you need privacy, or say goodbye to end our conversation.";

/** The only thing Hope says when ending; see end_voice_session. */
export const HOPE_GOODBYE = "Goodbye. I've stopped listening.";

export function createRPHopeAgent(): RealtimeAgent {
  return new RealtimeAgent({
    name: "Hope",
    instructions: ASSISTANT_INSTRUCTIONS,
    voice: REALTIME_VOICE,
    tools: rpHopeTools,
  });
}

/**
 * The Realtime session config: audio output, transcripts for captions, semantic
 * VAD turn detection with barge-in, medium reasoning effort, parallel tools.
 */
export function buildSessionConfig(): Partial<RealtimeSessionConfig> {
  return {
    outputModalities: ["audio"],
    reasoning: { effort: "medium" },
    parallelToolCalls: true,
    audio: {
      input: {
        transcription: { model: TRANSCRIBE_MODEL },
        turnDetection: {
          type: "semantic_vad",
          // "low" gives people more time to finish a sentence before Hope
          // takes a turn — our audience includes older users and people who
          // pause mid-thought. Supported by gpt-realtime-2.1 + SDK 0.13.
          eagerness: "low",
          createResponse: true,
          interruptResponse: true,
        },
      },
      output: { voice: REALTIME_VOICE },
    },
  } satisfies Partial<RealtimeSessionConfig>;
}
