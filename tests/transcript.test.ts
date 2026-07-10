import { describe, it, expect } from "vitest";
import { extractTranscript } from "@/lib/voice/transcript";
import type { RealtimeItem } from "@openai/agents/realtime";

// Minimal message items shaped like the SDK's history.
const history = [
  {
    itemId: "1",
    type: "message",
    role: "user",
    status: "completed",
    content: [{ type: "input_audio", transcript: "What is RPGR?" }],
  },
  {
    itemId: "2",
    type: "message",
    role: "assistant",
    status: "in_progress",
    content: [{ type: "output_audio", transcript: "RPGR is an X-linked gene." }],
  },
  {
    itemId: "3",
    type: "function_call",
    status: "completed",
    name: "search_rp_hope",
    arguments: "{}",
    output: null,
  },
  {
    itemId: "4",
    type: "message",
    role: "user",
    status: "completed",
    content: [{ type: "input_text", text: "" }],
  },
] as unknown as RealtimeItem[];

describe("transcript extraction", () => {
  it("keeps only non-empty message turns with role + text", () => {
    const turns = extractTranscript(history);
    expect(turns).toHaveLength(2);
    expect(turns[0]).toMatchObject({ role: "user", text: "What is RPGR?" });
    expect(turns[1]).toMatchObject({ role: "assistant", inProgress: true });
  });

  it("ignores function_call items and empty messages", () => {
    const turns = extractTranscript(history);
    expect(turns.every((t) => t.text.length > 0)).toBe(true);
    expect(turns.find((t) => t.id === "3")).toBeUndefined();
    expect(turns.find((t) => t.id === "4")).toBeUndefined();
  });

  it("returns empty for empty history (clearing behavior)", () => {
    expect(extractTranscript([])).toEqual([]);
  });
});
