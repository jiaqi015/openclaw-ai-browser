import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  initThreadStore,
  loadThreadStoreState,
  resolveThreadStoreRuntime,
} from "./ThreadStore.mjs";
import {
  initTurnJournalStore,
  loadTurnJournalState,
  serializeTurnJournalState,
} from "../turns/TurnJournalStore.mjs";
import { runThreadAiTurn } from "./ThreadTurnService.mjs";

test("runThreadAiTurn records a separate turn journal entry", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sabrina-thread-turn-"));

  initThreadStore({
    resolveStatePath: () => path.join(tempDir, "thread-state.json"),
  });
  initTurnJournalStore({
    resolveStatePath: () => path.join(tempDir, "turn-journal.json"),
  });
  await loadThreadStoreState();
  await loadTurnJournalState();

  const runtimeState = await resolveThreadStoreRuntime({
    tabs: [
      {
        tabId: "tab-1",
        title: "Docs",
        url: "http://localhost:3000/docs",
      },
    ],
  });
  const threadId = runtimeState.tabThreads["tab-1"].threadId;

  const result = await runThreadAiTurn(
    {
      threadId,
      userText: "帮我总结",
      actionPayload: {
        tabId: "tab-1",
        prompt: "帮我总结",
        skillName: "summarize",
        skillMode: "strict",
      },
    },
    {
      getContextSnapshotForTab: async () => ({
        title: "Docs",
        url: "http://localhost:3000/docs",
        selectedText: "",
        contentText: "Documentation body",
        leadText: "Documentation lead",
      }),
      getLocalSkillDetail: async () => ({
        name: "summarize",
        ready: true,
        browserCapability: {
          inputMode: "source-url",
          sourceKinds: ["public-url", "private-url"],
          useHint: "OpenClaw declared capability.",
          source: "skill-metadata",
          overlay: false,
        },
      }),
      runAiAction: async () => ({
        message: "总结完成",
        skillName: "summarize",
        model: "gpt-5.4",
      }),
    },
  );

  assert.equal(result.ok, true);
  assert.ok(result.journalEntryId);
  const journalState = serializeTurnJournalState();
  assert.equal(journalState.entries.length, 1);
  assert.equal(journalState.entries[0].threadId, threadId);
  assert.equal(journalState.entries[0].turnType, "skill");
  assert.equal(journalState.entries[0].receipt?.status, "completed");
});
