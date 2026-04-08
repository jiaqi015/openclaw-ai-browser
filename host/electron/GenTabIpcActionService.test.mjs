import test from "node:test";
import assert from "node:assert/strict";
import { generateGenTab, refreshGenTabItem } from "./GenTabIpcActionService.mjs";

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

/**
 * Live Cells 北极星场景（对标 Disco 的创新点）：
 *
 * 用户打开 3 个 GPU 商品页，GenTab 生成了一张 价格/显存/功耗 比价表。
 * 之后 tab_a 上 RTX 4090 降价。用户点该行的刷新按钮——期望：
 *   1. 只有目标行变化，其他行字节级相同
 *   2. schema 锁：模型不能引入新列（库存）也不能删列
 *   3. 溯源不可变：id / sourceTabId / sourceUrl 保持原值，哪怕模型试图改写
 *   4. metadata.lastCellRefreshAt 被盖上新时间戳
 *   5. saveGenTabData 恰好被调用一次
 */
const liveCellsBaseGenTab = {
  id: "gt_gpu",
  type: "comparison",
  title: "GPU 比价",
  items: [
    {
      id: "item_4090",
      title: "RTX 4090",
      sourceUrl: "https://store-a.example.com/gpu/4090",
      sourceTitle: "Store A",
      sourceTabId: "tab_a",
      quote: "RTX 4090 现货 ¥12999 显存 24GB TGP 450W",
      fields: { 价格: "¥12999", 显存: "24GB", 功耗: "450W" },
    },
    {
      id: "item_4080",
      title: "RTX 4080",
      sourceUrl: "https://store-b.example.com/gpu/4080",
      sourceTitle: "Store B",
      sourceTabId: "tab_b",
      quote: "RTX 4080 ¥8499 16GB 320W",
      fields: { 价格: "¥8499", 显存: "16GB", 功耗: "320W" },
    },
  ],
  metadata: {
    sourceTabIds: ["tab_a", "tab_b"],
    userIntent: "比较三款 GPU 的价格和规格",
    generatedAt: "2026-04-08T10:00:00.000Z",
  },
};

function makeLiveCellsDeps(overrides = {}) {
  const saved = [];
  return {
    saved,
    deps: {
      getGenTabRuntimeState: () => ({ gentab: structuredClone(liveCellsBaseGenTab) }),
      getContextSnapshotForTab: async (tabId) => ({
        tabId,
        url: "https://store-a.example.com/gpu/4090",
        title: "Store A — RTX 4090",
        contentText: "RTX 4090 降价至 ¥11999，显存 24GB，TGP 450W",
      }),
      runLocalAgentTurn: async () => ({
        text: JSON.stringify({
          success: true,
          item: {
            // 模型试图：(a) 改 id，(b) 改 sourceUrl，(c) 加一列 库存
            id: "HACKED",
            title: "RTX 4090",
            sourceUrl: "https://evil.example.com",
            sourceTitle: "Store A",
            sourceTabId: "tab_a",
            quote: "RTX 4090 降价至 ¥11999",
            fields: {
              价格: "¥11999",
              显存: "24GB",
              功耗: "450W",
              库存: "充足",
            },
          },
        }),
      }),
      saveGenTabData: async (genId, gentab) => {
        saved.push({ genId, gentab: structuredClone(gentab) });
      },
      ...overrides,
    },
  };
}

test("Live Cells 北极星：只变目标行，schema 锁住，溯源不可变", async () => {
  const { deps, saved } = makeLiveCellsDeps();

  const result = await refreshGenTabItem(
    { genId: "gt_gpu", itemId: "item_4090", assistantLocaleMode: "zh-CN" },
    deps,
  );

  assert.equal(result.success, true);
  assert.equal(saved.length, 1);
  const persisted = saved[0].gentab;

  const refreshed = persisted.items.find((i) => i.id === "item_4090");
  const untouched = persisted.items.find((i) => i.id === "item_4080");
  assert.equal(refreshed.fields["价格"], "¥11999");
  assert.deepEqual(untouched, liveCellsBaseGenTab.items[1]);

  // schema 锁
  assert.deepEqual(Object.keys(refreshed.fields), ["价格", "显存", "功耗"]);
  assert.equal(refreshed.fields["库存"], undefined);

  // 溯源不可变
  assert.equal(refreshed.id, "item_4090");
  assert.equal(refreshed.sourceUrl, liveCellsBaseGenTab.items[0].sourceUrl);
  assert.equal(refreshed.sourceTabId, "tab_a");

  // 时间戳：合法 ISO 且不等于原 generatedAt
  const stampedAt = Date.parse(persisted.metadata.lastCellRefreshAt);
  assert.ok(Number.isFinite(stampedAt));
  assert.notEqual(persisted.metadata.lastCellRefreshAt, liveCellsBaseGenTab.metadata.generatedAt);
  assert.equal(persisted.metadata.userIntent, liveCellsBaseGenTab.metadata.userIntent);
});

test("Live Cells：无 sourceTabId 的 item 被拒绝（untrackable）", async () => {
  const { deps, saved } = makeLiveCellsDeps({
    getGenTabRuntimeState: () => ({
      gentab: {
        ...structuredClone(liveCellsBaseGenTab),
        items: [{ ...liveCellsBaseGenTab.items[0], sourceTabId: "" }],
      },
    }),
  });
  const result = await refreshGenTabItem({ genId: "gt_gpu", itemId: "item_4090" }, deps);
  assert.equal(result.success, false);
  assert.match(result.error, /未记录源标签页/);
  assert.equal(saved.length, 0);
});

test("Live Cells：读 tab 快照失败时，报人话错误，不写盘", async () => {
  const { deps, saved } = makeLiveCellsDeps({
    getContextSnapshotForTab: async () => {
      throw new Error("tab closed");
    },
  });
  const result = await refreshGenTabItem({ genId: "gt_gpu", itemId: "item_4090" }, deps);
  assert.equal(result.success, false);
  assert.match(result.error, /无法读取源标签页/);
  assert.equal(saved.length, 0);
});

test("Live Cells：模型拒绝刷新时，错误上浮且不写盘", async () => {
  const { deps, saved } = makeLiveCellsDeps({
    runLocalAgentTurn: async () => ({
      text: JSON.stringify({ success: false, error: "原文无法支持该字段" }),
    }),
  });
  const result = await refreshGenTabItem({ genId: "gt_gpu", itemId: "item_4090" }, deps);
  assert.equal(result.success, false);
  assert.match(result.error, /原文无法支持/);
  assert.equal(saved.length, 0);
});

test("Live Cells：未知 genId / itemId 在调用 agent 前就被拒", async () => {
  let agentCalls = 0;
  const { deps } = makeLiveCellsDeps({
    runLocalAgentTurn: async () => {
      agentCalls += 1;
      return { text: "" };
    },
  });

  const missingGen = await refreshGenTabItem({ genId: "", itemId: "x" }, deps);
  assert.equal(missingGen.success, false);

  const missingItem = await refreshGenTabItem(
    { genId: "gt_gpu", itemId: "nonexistent" },
    deps,
  );
  assert.equal(missingItem.success, false);
  assert.match(missingItem.error, /未找到对应的 item/);
  assert.equal(agentCalls, 0);
});
