import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  getTurnJournalStats,
  initTurnJournalStore,
  loadTurnJournalState,
  recordTurnJournalEntry,
  searchTurnJournalEntries,
  serializeTurnJournalState,
} from "./TurnJournalStore.mjs";

test("recordTurnJournalEntry persists a separate turn journal record", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sabrina-turn-journal-"));
  const statePath = path.join(tempDir, "turn-journal.json");

  initTurnJournalStore({
    resolveStatePath: () => statePath,
  });
  await loadTurnJournalState();

  const entry = await recordTurnJournalEntry({
    turnId: "turn-1",
    threadId: "thread-1",
    turnType: "skill",
    strategy: "strict_skill_execution",
    policyDecision: "allow",
    summary: "技能 summarize 已完成",
    executionContract: {
      contractVersion: 1,
      browserContextContract: "browser-context-package",
      resultContract: "skill-result",
      requiredEvidence: ["skill-receipt", "skill-trace"],
    },
  });

  assert.equal(entry.turnId, "turn-1");
  const snapshot = serializeTurnJournalState();
  assert.equal(snapshot.entries.length, 1);
  assert.equal(snapshot.entries[0].threadId, "thread-1");
  assert.deepEqual(snapshot.entries[0].executionContract.requiredEvidence, [
    "skill-receipt",
    "skill-trace",
  ]);
  assert.equal(getTurnJournalStats().count, 1);
  assert.equal(searchTurnJournalEntries("turn-1").length, 1);
});
