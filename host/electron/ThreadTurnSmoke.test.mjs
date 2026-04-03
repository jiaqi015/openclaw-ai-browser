import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  initThreadStore,
  loadThreadStoreState,
  resolveThreadStoreRuntime,
  serializeThreadRuntimeState,
} from "../../runtime/threads/ThreadStore.mjs";
import {
  getTurnJournalStats,
  initTurnJournalStore,
  loadTurnJournalState,
  searchTurnJournalEntries,
} from "../../runtime/turns/TurnJournalStore.mjs";
import { runThreadAiTurn } from "../../runtime/threads/ThreadTurnService.mjs";
import { runAiAction } from "./ThreadIpcActionService.mjs";

test("thread turn smoke covers page to thread to host execution to receipt", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sabrina-thread-smoke-"));
  let capturedPrompt = "";

  try {
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
          title: "Smoke Spec",
          url: "https://example.com/spec",
        },
      ],
    });
    const threadId = runtimeState.tabThreads["tab-1"].threadId;

    const result = await runThreadAiTurn(
      {
        threadId,
        userText: "帮我总结这个页面",
        actionPayload: {
          tabId: "tab-1",
          prompt: "帮我总结这个页面",
        },
      },
      {
        getContextSnapshotForTab: async () => ({
          title: "Smoke Spec",
          url: "https://example.com/spec",
          selectedText: "",
          contentText: "Spec body",
          leadText: "Spec lead",
        }),
        runAiAction: (payload) =>
          runAiAction(payload, {
            getActiveTabId: () => "tab-1",
            ensureSabrinaBrowserAgent: async () => ({ agentId: "sabrina-browser" }),
            getOpenClawSessionId: (tabId) => `session:${tabId}`,
            runGatewayChatCompletion: async ({ message }) => {
              capturedPrompt = message;
              return {
                text: "总结完成",
                sessionId: "session:tab-1",
                model: "gpt-5.4",
                durationMs: 12,
              };
            },
            recordAiTurn: () => {},
          }),
      },
    );

    const nextRuntimeState = serializeThreadRuntimeState();
    const threadMessages = nextRuntimeState.state.messagesByThreadId[threadId] ?? [];

    assert.equal(result.ok, true);
    assert.equal(threadMessages.length, 3);
    assert.equal(threadMessages[1].role, "user");
    assert.equal(threadMessages[2].role, "assistant");
    assert.match(capturedPrompt, /Smoke Spec/);
    assert.match(capturedPrompt, /Spec lead|Spec body/);
    assert.equal(getTurnJournalStats().count, 1);
    assert.equal(searchTurnJournalEntries("总结完成").length, 1);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
