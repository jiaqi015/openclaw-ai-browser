import test from "node:test";
import assert from "node:assert/strict";
import { buildOpenClawRuntimeInsights } from "./OpenClawRuntimeService.mjs";

test("buildOpenClawRuntimeInsights projects capability, journal, and memory facts", () => {
  const insights = buildOpenClawRuntimeInsights({
    state: {
      connectionState: {
        remoteSessionContract: {
          contractVersion: "1",
          driver: "ssh-cli",
          transport: "remote",
          features: ["turn-journal-v1"],
        },
      },
      skillCatalog: {
        summary: {
          browserCapabilitySchemaVersion: "1",
          total: 8,
          eligible: 7,
          ready: 6,
          disabled: 1,
          blockedByAllowlist: 0,
          missingRequirements: 1,
          capabilitySourceCounts: {
            declared: 4,
            overlay: 1,
            heuristic: 1,
            metadata: 4,
          },
        },
      },
    },
    turnJournalStats: {
      path: "/tmp/turn-journal.json",
      count: 12,
      latestCreatedAt: "2026-04-07T12:00:00.000Z",
      latestThreadId: "thread-1",
      latestTurnId: "turn-1",
      latestStatus: "completed",
      statusCounts: { completed: 11, failed: 1 },
    },
    browserMemoryStats: {
      path: "/tmp/memory.json",
      count: 5,
      latestCapturedAt: "2026-04-07T11:00:00.000Z",
    },
  });

  assert.equal(insights.remoteSessionContract?.driver, "ssh-cli");
  assert.equal(insights.skillCatalog?.ready, 6);
  assert.equal(insights.skillCatalog?.capabilitySourceCounts.declared, 4);
  assert.equal(insights.turnJournal?.count, 12);
  assert.equal(insights.browserMemory?.count, 5);
});
