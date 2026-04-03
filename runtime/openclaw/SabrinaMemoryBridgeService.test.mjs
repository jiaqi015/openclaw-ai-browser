import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  getOpenClawTransportContext,
  setOpenClawTransportContext,
} from "./OpenClawTransportContext.mjs";
import {
  getBrowserMemoryStats,
  saveBrowserMemoryRecord,
  searchBrowserMemoryRecords,
} from "./SabrinaMemoryBridgeService.mjs";

test("memory bridge stores and recalls browser records in the selected state dir", async () => {
  const previous = getOpenClawTransportContext();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sabrina-memory-"));

  try {
    setOpenClawTransportContext({
      transport: "local",
      stateDir: tmpDir,
    });

    const record = await saveBrowserMemoryRecord({
      url: "https://example.com/docs",
      host: "example.com",
      title: "Example Docs",
      summary: "Example summary",
      keywords: ["docs", "example"],
    });

    const matches = await searchBrowserMemoryRecords("example docs");
    const stats = await getBrowserMemoryStats();

    assert.equal(record.url, "https://example.com/docs");
    assert.equal(record.schemaVersion, "2");
    assert.equal(record.metadata.threadId, undefined);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].id, record.id);
    assert.equal(stats.count, 1);
  } finally {
    setOpenClawTransportContext(previous);
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
