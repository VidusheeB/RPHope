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

export function createRPHopeAgent(): RealtimeAgent {
  return new RealtimeAgent({
    name: "RP Hope Guide",
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
          eagerness: "medium",
          createResponse: true,
          interruptResponse: true,
        },
      },
      output: { voice: REALTIME_VOICE },
    },
  } satisfies Partial<RealtimeSessionConfig>;
}
