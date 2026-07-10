// Turn a RealtimeSession history (RealtimeItem[]) into a simple caption/
// transcript model for the UI. Message items only; text comes from either the
// typed text or the audio transcript, whichever is present.

import type { RealtimeItem } from "@openai/agents/realtime";

export type TranscriptRole = "user" | "assistant" | "system";

export type TranscriptTurn = {
  id: string;
  role: TranscriptRole;
  text: string;
  inProgress: boolean;
};

export function extractTranscript(history: RealtimeItem[]): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];
  for (const item of history) {
    if (item.type !== "message") continue;
    let text = "";
    for (const c of item.content) {
      if ("text" in c && typeof c.text === "string") text += c.text;
      else if ("transcript" in c && typeof c.transcript === "string" && c.transcript)
        text += c.transcript;
    }
    text = text.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const status = "status" in item ? item.status : "completed";
    turns.push({
      id: item.itemId,
      role: item.role,
      text,
      inProgress: status === "in_progress",
    });
  }
  return turns;
}
