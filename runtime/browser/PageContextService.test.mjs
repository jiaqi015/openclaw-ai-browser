import test from "node:test";
import assert from "node:assert/strict";
import {
  clearPageContextSnapshotCache,
  extractPageContextSnapshot,
} from "./PageContextService.mjs";

test("extractPageContextSnapshot reuses a short-lived cached snapshot", async () => {
  clearPageContextSnapshotCache();

  let executeCount = 0;
  const webContents = {
    id: 101,
    async executeJavaScript() {
      executeCount += 1;
      return {
        title: "Example",
        url: "https://example.com",
        selectedText: "",
        metadata: {
          description: "",
          language: "zh-CN",
          documentContentType: "text/html",
        },
        headings: ["Heading"],
        links: [],
        contentText: "Example page body",
        leadText: "Example lead",
        sections: [],
      };
    },
  };

  const firstSnapshot = await extractPageContextSnapshot({
    webContents,
    fallbackTitle: "Example",
    fallbackUrl: "https://example.com",
    cacheTtlMs: 5_000,
  });
  const secondSnapshot = await extractPageContextSnapshot({
    webContents,
    fallbackTitle: "Example",
    fallbackUrl: "https://example.com",
    cacheTtlMs: 5_000,
  });

  assert.equal(executeCount, 1);
  assert.equal(firstSnapshot.snapshotId, secondSnapshot.snapshotId);
});

test("extractPageContextSnapshot invalidates cache when selection changes", async () => {
  clearPageContextSnapshotCache();

  let executeCount = 0;
  const webContents = {
    id: 202,
    async executeJavaScript() {
      executeCount += 1;
      return {
        title: "Example",
        url: "https://example.com",
        selectedText: executeCount === 1 ? "" : "new selection",
        metadata: {
          description: "",
          language: "zh-CN",
          documentContentType: "text/html",
        },
        headings: [],
        links: [],
        contentText: "Example page body",
        leadText: "Example lead",
        sections: [],
      };
    },
  };

  await extractPageContextSnapshot({
    webContents,
    fallbackTitle: "Example",
    fallbackUrl: "https://example.com",
    selectedText: "",
    cacheTtlMs: 5_000,
  });
  await extractPageContextSnapshot({
    webContents,
    fallbackTitle: "Example",
    fallbackUrl: "https://example.com",
    selectedText: "new selection",
    cacheTtlMs: 5_000,
  });

  assert.equal(executeCount, 2);
});
