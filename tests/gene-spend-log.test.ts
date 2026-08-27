// The spend ledger — what the pipeline has actually cost across batches.

import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  recordSpend,
  readSpendLog,
  summarizeSpend,
  formatSpendSummary,
  type SpendEntry,
} from "@/lib/geneResearch/spendLog";

const entry = (over: Partial<SpendEntry> = {}): SpendEntry => ({
  at: "2026-08-25T12:00:00.000Z",
  gene: "RPGR",
  model: "claude-opus-4-8",
  inputTokens: 1000,
  outputTokens: 500,
  costUsd: 0.02,
  outcome: "ok",
  ...over,
});

function tmpLog() {
  return join(mkdtempSync(join(tmpdir(), "spend-")), "spend-log.jsonl");
}

describe("spend ledger", () => {
  it("round-trips appended entries", () => {
    const path = tmpLog();
    recordSpend(entry(), path);
    recordSpend(entry({ gene: "ABCA4", costUsd: 0.05 }), path);
    const log = readSpendLog(path);
    expect(log).toHaveLength(2);
    expect(log[1].gene).toBe("ABCA4");
  });

  it("survives a torn final line from an interrupted run", () => {
    const path = tmpLog();
    recordSpend(entry(), path);
    writeFileSync(path, readSpendLog(path).map((e) => JSON.stringify(e)).join("\n") + '\n{"at":"2026', "utf8");
    expect(readSpendLog(path)).toHaveLength(1);
  });

  it("returns empty for a ledger that does not exist yet", () => {
    expect(readSpendLog(join(tmpdir(), "definitely-not-here.jsonl"))).toEqual([]);
  });

  it("never throws when the path is unwritable", () => {
    expect(() => recordSpend(entry(), "/nonexistent-root-dir/x/y.jsonl")).not.toThrow();
  });
});

describe("spend summary", () => {
  it("counts rejected and failed calls as real spend", () => {
    // These were billed even though no draft survived — hiding them would
    // understate what the run actually cost.
    const s = summarizeSpend([
      entry({ costUsd: 0.1, outcome: "ok" }),
      entry({ gene: "KIZ", costUsd: 0.2, outcome: "rejected" }),
      entry({ gene: "LCA5", costUsd: 0.3, outcome: "failed" }),
    ]);
    expect(s.totalUsd).toBeCloseTo(0.6, 5);
    expect(s.wastedUsd).toBeCloseTo(0.5, 5);
    expect(s.genes).toBe(3);
    expect(s.calls).toBe(3);
  });

  it("counts a retried gene once, but both its calls", () => {
    const s = summarizeSpend([
      entry({ gene: "RHO", outcome: "failed", costUsd: 0.1 }),
      entry({ gene: "RHO", outcome: "ok", costUsd: 0.2 }),
    ]);
    expect(s.genes).toBe(1);
    expect(s.calls).toBe(2);
    expect(s.totalUsd).toBeCloseTo(0.3, 5);
  });

  it("projects from kept drafts, not from total spend over genes touched", () => {
    const out = formatSpendSummary(
      summarizeSpend([entry({ costUsd: 0.2 }), entry({ gene: "ABCA4", costUsd: 0.2 })]),
      10
    );
    expect(out).toContain("$0.40");
    expect(out).toContain("~$2.00 more for the remaining 10");
  });

  it("does not let one-off wasted spend inflate the projection", () => {
    // A bug once rejected five generated drafts. Folding that into the per-gene
    // rate forever would overstate the remaining cost by roughly double.
    const out = formatSpendSummary(
      summarizeSpend([
        entry({ gene: "A", costUsd: 0.3, outcome: "ok" }),
        entry({ gene: "B", costUsd: 0.4, outcome: "rejected" }),
        entry({ gene: "C", costUsd: 0.4, outcome: "rejected" }),
      ]),
      10
    );
    expect(out).toContain("~$3.00 more for the remaining 10"); // 0.30 x 10, not 1.10/3 x 10
    expect(out).toContain("all-in average incl. discarded work");
  });

  it("reports an empty ledger plainly", () => {
    expect(formatSpendSummary(summarizeSpend([]))).toBe("No billed calls recorded yet.");
  });
});
