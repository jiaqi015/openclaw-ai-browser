import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  clearPendingGenTabMetadata,
  getGenTabRuntimeState,
  initGenTabStore,
  loadGenTabStoreState,
  saveGenTabData,
  serializeGenTabStoreState,
  setPendingGenTabMetadata,
} from "./GenTabStore.mjs";

test("GenTabStore persists pending metadata and generated data in main-process state", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sabrina-gentab-store-"));
  const statePath = path.join(tempDir, "gentab-state.json");

  initGenTabStore({
    resolveStatePath: () => statePath,
  });
  await loadGenTabStoreState();

  await setPendingGenTabMetadata("gen-1", {
    referenceTabIds: ["tab-a", "tab-b"],
    userIntent: "整理竞品对比",
    preferredType: "comparison",
  });
  await saveGenTabData("gen-1", {
    schemaVersion: "2",
    type: "comparison",
    title: "竞品对比台",
    items: [],
    metadata: {
      sourceTabIds: ["tab-a", "tab-b"],
      userIntent: "整理竞品对比",
      generatedAt: new Date().toISOString(),
      preferredType: "comparison",
    },
  });

  let record = getGenTabRuntimeState("gen-1");
  assert.equal(record.pendingMetadata?.userIntent, "整理竞品对比");
  assert.equal(record.gentab?.title, "竞品对比台");

  await clearPendingGenTabMetadata("gen-1");
  record = getGenTabRuntimeState("gen-1");
  assert.equal(record.pendingMetadata, null);
  assert.equal(record.gentab?.title, "竞品对比台");

  await loadGenTabStoreState();
  const snapshot = serializeGenTabStoreState();
  assert.equal(snapshot.pendingById["gen-1"], undefined);
  assert.equal(snapshot.genTabsById["gen-1"].title, "竞品对比台");
});
