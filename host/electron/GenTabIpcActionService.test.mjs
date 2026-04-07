import test from "node:test";
import assert from "node:assert/strict";
import { generateGenTab } from "./GenTabIpcActionService.mjs";

test("generateGenTab uses Browser Context Package provenance for host-level generation", async () => {
  const snapshots = {
    "tab-a": {
      title: "A 产品",
      url: "https://a.example.com",
      hostname: "a.example.com",
      leadText: "A 的导语",
      contentPreview: "A 摘要",
      contentText: "A 正文",
      selectedText: "",
      headings: ["价格"],
      sections: [{ title: "价格", summary: "A 价格摘要" }],
    },
    "tab-b": {
      title: "B 产品",
      url: "https://b.example.com",
      hostname: "b.example.com",
      leadText: "B 的导语",
      contentPreview: "B 摘要",
      contentText: "B 正文",
      selectedText: "",
      headings: ["功能"],
      sections: [{ title: "功能", summary: "B 功能摘要" }],
    },
  };
  let capturedPrompt = "";
  let persistedGenId = "";
  let clearedGenId = "";

  const result = await generateGenTab(
    {
      genId: "gentab-1",
      referenceTabIds: ["tab-a", "missing-tab", "tab-b"],
      userIntent: "整理竞品对比",
      preferredType: "comparison",
    },
    {
      getContextSnapshotForTab: async (tabId) => {
        if (!snapshots[tabId]) {
          throw new Error(`missing ${tabId}`);
        }
        return snapshots[tabId];
      },
      runLocalAgentTurn: async ({ message }) => {
        capturedPrompt = message;
        return {
          text: JSON.stringify({
            success: true,
            gentab: {
              schemaVersion: "2",
              type: "comparison",
              title: "竞品对比台",
              items: [
                {
                  id: "a",
                  title: "A 产品",
                  sourceUrl: "https://a.example.com",
                  sourceTitle: "A 产品",
                },
              ],
            },
          }),
        };
      },
      saveGenTabData: async (genId, gentab) => {
        persistedGenId = genId;
        assert.equal(gentab.title, "竞品对比台");
      },
      clearPendingGenTabMetadata: async (genId) => {
        clearedGenId = genId;
      },
    },
  );

  assert.equal(result.success, true);
  assert.equal(persistedGenId, "gentab-1");
  assert.equal(clearedGenId, "gentab-1");
  assert.match(capturedPrompt, /Browser Context Package provenance/);
  assert.match(capturedPrompt, /Browser Context Package execution/);
  assert.match(capturedPrompt, /缺失引用页 ID：missing-tab/);
  assert.equal(result.executionPlan.strategy, "artifact_generation");
  assert.deepEqual(result.gentab.metadata.sourceTabIds, ["tab-a", "missing-tab", "tab-b"]);
  assert.deepEqual(result.gentab.metadata.missingReferenceTabIds, ["missing-tab"]);
});
