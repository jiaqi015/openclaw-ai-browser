import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGenTabPrompt,
  buildRefreshItemPrompt,
  normalizeGeneratedGenTab,
  normalizeRefreshedItem,
} from "./GenTabGenerationService.mjs";

test("buildGenTabPrompt consumes Browser Context Package provenance", () => {
  const prompt = buildGenTabPrompt(
    "整理竞品对比",
    {
      sourceTabId: "tab-a",
      sourceTabIds: ["tab-a", "tab-b", "tab-c"],
      selectionState: "selection",
      requestedReferenceTabIds: ["tab-b", "tab-c"],
      missingReferenceTabIds: ["tab-c"],
      stats: {
        totalApproxChars: 2048,
      },
      execution: {
        primarySourceKind: "public-http",
        authBoundary: "none",
        trustLevel: "public",
        reproducibility: "replayable",
        summary: {
          totalSourceCount: 2,
          executableSourceCount: 2,
          browserOnlySourceCount: 0,
          replayableSourceCount: 2,
          sourceKindCounts: {
            publicHttp: 2,
            privateHttp: 0,
            localFile: 0,
            internalSurface: 0,
            nonHttp: 0,
            missingUrl: 0,
          },
        },
        sources: [
          {
            role: "primary",
            tabId: "tab-a",
            sourceKind: "public-http",
            trustLevel: "public",
            authBoundary: "none",
            reproducibility: "replayable",
          },
          {
            role: "reference",
            tabId: "tab-b",
            sourceKind: "public-http",
            trustLevel: "public",
            authBoundary: "none",
            reproducibility: "replayable",
          },
        ],
      },
      primary: {
        title: "A 产品",
        url: "https://a.example.com",
        hostname: "a.example.com",
        selectedText: "重点功能 A",
        leadText: "A 的导语",
        headings: ["价格", "功能"],
        sections: [{ title: "价格", summary: "A 价格摘要" }],
        contentPreview: "A 摘要",
        contentText: "A 正文",
      },
      references: [
        {
          tabId: "tab-b",
          context: {
            title: "B 产品",
            url: "https://b.example.com",
            hostname: "b.example.com",
            selectedText: "",
            leadText: "B 的导语",
            headings: ["定价"],
            sections: [{ title: "定价", summary: "B 价格摘要" }],
            contentPreview: "B 摘要",
            contentText: "B 正文",
          },
        },
      ],
    },
    "comparison",
  );

  assert.match(prompt, /Browser Context Package provenance/);
  assert.match(prompt, /Browser Context Package execution/);
  assert.match(prompt, /主来源类型：public-http/);
  assert.match(prompt, /来源类型统计：public-http=2/);
  assert.match(prompt, /缺失引用页 ID：tab-c/);
  assert.match(prompt, /网页 1（主来源页）/);
  assert.match(prompt, /网页 2（引用页）/);
});

test("normalizeGeneratedGenTab preserves GenTab provenance metadata from context package", () => {
  const gentab = normalizeGeneratedGenTab(
    {
      schemaVersion: "2",
      type: "comparison",
      title: "竞品台",
      items: [
        {
          id: "item-1",
          title: "A 产品",
          sourceUrl: "https://a.example.com",
          sourceTitle: "A 产品",
        },
      ],
    },
    {
      userIntent: "整理竞品对比",
      preferredType: "comparison",
      contextPackage: {
        sourceTabId: "tab-a",
        sourceTabIds: ["tab-a", "tab-b", "tab-c"],
        selectionState: "selection",
        requestedReferenceTabIds: ["tab-b", "tab-c"],
        missingReferenceTabIds: ["tab-c"],
        stats: {
          totalApproxChars: 2048,
        },
        primary: {
          title: "A 产品",
          url: "https://a.example.com",
          hostname: "a.example.com",
          leadText: "A 的导语",
          contentPreview: "A 摘要",
          contentText: "A 正文",
        },
        references: [
          {
            tabId: "tab-b",
            context: {
              title: "B 产品",
              url: "https://b.example.com",
              hostname: "b.example.com",
              leadText: "B 的导语",
              contentPreview: "B 摘要",
              contentText: "B 正文",
            },
          },
        ],
      },
    },
  );

  assert.deepEqual(gentab.metadata.sourceTabIds, ["tab-a", "tab-b", "tab-c"]);
  assert.deepEqual(gentab.metadata.requestedReferenceTabIds, ["tab-b", "tab-c"]);
  assert.deepEqual(gentab.metadata.missingReferenceTabIds, ["tab-c"]);
  assert.equal(gentab.metadata.selectionState, "selection");
  assert.equal(gentab.metadata.totalApproxChars, 2048);
});

test("Live Cells: buildGenTabPrompt documents the new sourceTabId/quote contract", () => {
  const prompt = buildGenTabPrompt(
    "整理对比",
    {
      sourceTabId: "tab-a",
      sourceTabIds: ["tab-a"],
      primary: {
        title: "A",
        url: "https://a.example.com",
        hostname: "a.example.com",
        contentText: "A 正文",
      },
      references: [],
    },
    "auto",
  );
  assert.match(prompt, /Live Cells 字段/);
  assert.match(prompt, /sourceTabId/);
  assert.match(prompt, /quote/);
});

test("Live Cells: normalizeGeneratedGenTab preserves quote and backfills sourceTabId by URL", () => {
  const gentab = normalizeGeneratedGenTab(
    {
      schemaVersion: "2",
      type: "comparison",
      title: "竞品台",
      items: [
        {
          id: "item-1",
          title: "A 产品",
          sourceUrl: "https://a.example.com",
          sourceTitle: "A 产品",
          quote: "A 的定价是每月 9 美元",
          // sourceTabId intentionally omitted — should be backfilled from provenance
          fields: { 价格: "$9/月" },
        },
        {
          id: "item-2",
          title: "B 产品",
          sourceUrl: "https://b.example.com",
          sourceTitle: "B 产品",
          sourceTabId: "tab-b",
          quote: "B 的定价是每月 19 美元",
          fields: { 价格: "$19/月" },
        },
      ],
    },
    {
      userIntent: "整理对比",
      preferredType: "comparison",
      contextPackage: {
        sourceTabId: "tab-a",
        sourceTabIds: ["tab-a", "tab-b"],
        primary: {
          title: "A 产品",
          url: "https://a.example.com",
          hostname: "a.example.com",
          contentText: "A 正文",
        },
        references: [
          {
            tabId: "tab-b",
            context: {
              title: "B 产品",
              url: "https://b.example.com",
              hostname: "b.example.com",
              contentText: "B 正文",
            },
          },
        ],
      },
    },
  );

  assert.equal(gentab.items[0].sourceTabId, "tab-a", "should backfill tab-a from url");
  assert.equal(gentab.items[0].quote, "A 的定价是每月 9 美元");
  assert.equal(gentab.items[1].sourceTabId, "tab-b", "should preserve explicit tab-b");
  assert.equal(gentab.items[1].quote, "B 的定价是每月 19 美元");
});

test("Live Cells: buildRefreshItemPrompt injects original item and fresh context", () => {
  const prompt = buildRefreshItemPrompt({
    item: {
      id: "item-1",
      title: "A 产品",
      fields: { 价格: "$9/月", 评分: "4.5" },
      quote: "原先的价格说明",
    },
    context: {
      title: "A 产品 - 2026 最新版",
      url: "https://a.example.com",
      contentText: "A 产品的新定价是每月 12 美元，评分 4.6。",
    },
    userIntent: "整理对比",
  });

  assert.match(prompt, /GenTab 单元格刷新器/);
  assert.match(prompt, /"id": "item-1"/);
  assert.match(prompt, /"价格": "\$9\/月"/);
  assert.match(prompt, /A 产品 - 2026 最新版/);
  assert.match(prompt, /每月 12 美元/);
  assert.match(prompt, /em dash/);
});

test("Live Cells: normalizeRefreshedItem clamps field keys and preserves provenance", () => {
  const original = {
    id: "item-1",
    title: "A 产品",
    sourceUrl: "https://a.example.com",
    sourceTitle: "A 产品",
    sourceTabId: "tab-a",
    quote: "旧 quote",
    fields: { 价格: "$9/月", 评分: "4.5" },
  };

  const refreshed = normalizeRefreshedItem(
    {
      id: "should-be-ignored",
      title: "A 产品（更新）",
      // model tried to invent a new column — must be dropped
      fields: { 价格: "$12/月", 评分: "", 新增列: "不应出现" },
      quote: "新的原文片段来自最新页面",
      // model tries to change provenance — must be ignored
      sourceUrl: "https://evil.example.com",
      sourceTabId: "tab-evil",
    },
    original,
  );

  assert.equal(refreshed.id, "item-1", "id is immutable");
  assert.equal(refreshed.title, "A 产品（更新）");
  assert.equal(refreshed.sourceUrl, "https://a.example.com", "sourceUrl untouched");
  assert.equal(refreshed.sourceTabId, "tab-a", "sourceTabId untouched");
  assert.deepEqual(Object.keys(refreshed.fields), ["价格", "评分"], "no new columns");
  assert.equal(refreshed.fields["价格"], "$12/月");
  assert.equal(refreshed.fields["评分"], "—", "empty field becomes em dash");
  assert.equal(refreshed.quote, "新的原文片段来自最新页面");
});
