import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGenTabPrompt,
  normalizeGeneratedGenTab,
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
