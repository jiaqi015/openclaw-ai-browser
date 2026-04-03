import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBrowserContextPackage,
  buildBrowserContextPackageFromTabSet,
  getContextPackageSourceTabIds,
} from "./BrowserContextPackageService.mjs";

test("buildBrowserContextPackage packages primary context, deduped references, and missing refs", async () => {
  const snapshots = {
    active: {
      title: "Active Tab",
      url: "http://localhost:3000/docs",
      selectedText: "Selected text",
      contentText: "Active content",
      extraction: { approxChars: 120, pageTruncated: true },
    },
    refA: {
      title: "Reference A",
      url: "https://example.com/a",
      selectedText: "",
      contentText: "Reference content A",
      extraction: { approxChars: 80 },
    },
    refB: {
      title: "Reference B",
      url: "https://example.com/b",
      selectedText: "",
      contentText: "Reference content B",
      extraction: { approxChars: 60, selectionTruncated: true },
    },
  };

  const contextPackage = await buildBrowserContextPackage(
    {
      activeTabId: "active",
      referenceTabIds: ["active", "refA", "refA", "missing", "refB"],
    },
    {
      getContextSnapshotForTab: async (tabId) => {
        if (!snapshots[tabId]) {
          throw new Error(`missing ${tabId}`);
        }
        return snapshots[tabId];
      },
    },
  );

  assert.equal(contextPackage.sourceTabId, "active");
  assert.equal(contextPackage.selectionState, "selection");
  assert.deepEqual(contextPackage.requestedReferenceTabIds, ["refA", "missing", "refB"]);
  assert.deepEqual(
    contextPackage.references.map((entry) => entry.tabId),
    ["refA", "refB"],
  );
  assert.deepEqual(contextPackage.missingReferenceTabIds, ["missing"]);
  assert.equal(contextPackage.stats.referenceCount, 2);
  assert.equal(contextPackage.stats.missingReferenceCount, 1);
  assert.equal(contextPackage.stats.totalApproxChars, 260);
  assert.equal(contextPackage.execution.primarySourceKind, "private-http");
  assert.equal(contextPackage.execution.primarySourceLabel, "本机或私有 HTTP(S) 页面");
  assert.equal(contextPackage.execution.reachability, "unknown");
  assert.equal(contextPackage.execution.authBoundary, "private-origin");
  assert.equal(contextPackage.execution.trustLevel, "private");
  assert.equal(contextPackage.execution.reproducibility, "not-guaranteed");
  assert.equal(contextPackage.execution.executionReliability, "medium");
  assert.equal(contextPackage.execution.reachabilityConfidence, "medium");
  assert.equal(contextPackage.execution.authBoundaryConfidence, "medium");
  assert.equal(contextPackage.execution.reproducibilityGuarantee, "weak");
  assert.equal(contextPackage.execution.outsideBrowserExecutable, false);
  assert.equal(contextPackage.execution.requiresBrowserSession, true);
  assert.equal(contextPackage.execution.requiresFilesystemAccess, false);
  assert.equal(contextPackage.execution.sources.length, 3);
  assert.equal(contextPackage.execution.sources[0].role, "primary");
  assert.equal(contextPackage.execution.sources[1].role, "reference");
  assert.equal(contextPackage.execution.sources[1].sourceKind, "public-http");
  assert.equal(contextPackage.execution.summary.totalSourceCount, 3);
  assert.equal(contextPackage.execution.summary.executableSourceCount, 3);
  assert.equal(contextPackage.execution.summary.replayableSourceCount, 2);
  assert.equal(contextPackage.execution.summary.outsideBrowserExecutableCount, 2);
  assert.equal(contextPackage.execution.summary.requiresBrowserSessionCount, 1);
  assert.equal(contextPackage.execution.summary.requiresFilesystemAccessCount, 0);
  assert.equal(contextPackage.execution.summary.deterministicReplayableCount, 2);
  assert.deepEqual(contextPackage.execution.summary.sourceKindCounts, {
    publicHttp: 2,
    privateHttp: 1,
    localFile: 0,
    internalSurface: 0,
    nonHttp: 0,
    missingUrl: 0,
  });
  assert.deepEqual(contextPackage.execution.lossinessFlags, [
    "primary-page-truncated",
    "missing-references",
    "reference-selection-truncated",
  ]);
});

test("buildBrowserContextPackageFromTabSet preserves the full source tab set", async () => {
  const contextPackage = await buildBrowserContextPackageFromTabSet(
    {
      tabIds: ["tab-1", "tab-2", "tab-2", "tab-3"],
    },
    {
      getContextSnapshotForTab: async (tabId) => ({
        title: tabId,
        selectedText: "",
        contentText: `content for ${tabId}`,
      }),
    },
  );

  assert.equal(contextPackage.sourceTabId, "tab-1");
  assert.deepEqual(contextPackage.sourceTabIds, ["tab-1", "tab-2", "tab-3"]);
  assert.deepEqual(getContextPackageSourceTabIds(contextPackage), [
    "tab-1",
    "tab-2",
    "tab-3",
  ]);
});

test("buildBrowserContextPackage records file execution facts for safe local paths", async () => {
  const contextPackage = await buildBrowserContextPackage(
    {
      activeTabId: "file-tab",
    },
    {
      getContextSnapshotForTab: async () => ({
        title: "Package",
        url: "file:///Users/jiaqi/Documents/Playground/sabrina-ai-browser/package.json",
        selectedText: "",
        contentText: "package",
      }),
    },
  );

  assert.equal(contextPackage.execution.primarySourceKind, "local-file");
  assert.equal(contextPackage.execution.trustLevel, "local");
  assert.equal(contextPackage.execution.sourceProtocol, "file:");
  assert.match(contextPackage.execution.sourceFilePath, /package\.json$/);
  assert.equal(contextPackage.execution.requiresFilesystemAccess, true);
  assert.equal(contextPackage.execution.outsideBrowserExecutable, false);
  assert.equal(contextPackage.execution.summary.sourceKindCounts.localFile, 1);
  assert.equal(contextPackage.execution.summary.requiresFilesystemAccessCount, 1);
  assert.equal(contextPackage.execution.sources[0].canExecute, true);
});
