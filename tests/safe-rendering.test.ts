import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// Model output is spoken and shown as plain text. Guard against anyone
// introducing raw-HTML injection in the voice assistant surface.
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(full)) out.push(full);
  }
  return out;
}

describe("safe rendering of model output", () => {
  it("no voice-assistant file uses dangerouslySetInnerHTML", () => {
    const roots = [
      path.resolve(__dirname, "../components/site/voice-assistant"),
      path.resolve(__dirname, "../hooks"),
      path.resolve(__dirname, "../lib/voice"),
    ];
    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of walk(root)) {
        if (readFileSync(file, "utf8").includes("dangerouslySetInnerHTML")) {
          offenders.push(file);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
