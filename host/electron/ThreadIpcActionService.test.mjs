import test from "node:test";
import assert from "node:assert/strict";
import { runAiAction } from "./ThreadIpcActionService.mjs";

test("runAiAction composes browser context package through the host service boundary", async () => {
  const snapshots = {
    active: {
      title: "Active Tab",
      url: "https://active.example.com",
      leadText: "Active lead",
      contentPreview: "Active preview",
      contentText: "Active body",
      selectedText: "",
      headings: ["Overview"],
      sections: [],
    },
    refA: {
      title: "Reference Tab",
      url: "https://reference.example.com",
      leadText: "Reference lead",
      contentPreview: "Reference preview",
      contentText: "Reference body",
      selectedText: "",
      headings: ["Pricing"],
      sections: [],
    },
  };
  let capturedPrompt = "";

  const response = await runAiAction(
    {
      action: "ask",
      prompt: "帮我总结",
      referenceTabIds: ["refA"],
      getContextSnapshotForTab: async (tabId) => {
        if (!snapshots[tabId]) {
          throw new Error(`missing ${tabId}`);
        }
        return snapshots[tabId];
      },
    },
    {
      getActiveTabId: () => "active",
      ensureSabrinaBrowserAgent: async () => ({ agentId: "sabrina-browser" }),
      getOpenClawSessionId: (tabId) => `session:${tabId}`,
      runGatewayChatCompletion: async ({ message }) => {
        capturedPrompt = message;
        return {
          text: "总结完成",
          sessionId: "session:active",
          model: "gpt-5.4",
          durationMs: 12,
        };
      },
      recordAiTurn: () => {},
    },
  );

  assert.equal(response.message, "总结完成");
  assert.equal(response.contextPackage.primary.title, "Active Tab");
  assert.equal(response.contextPackage.references[0].tabId, "refA");
  assert.match(capturedPrompt, /Active Tab/);
  assert.match(capturedPrompt, /Reference Tab/);
});
