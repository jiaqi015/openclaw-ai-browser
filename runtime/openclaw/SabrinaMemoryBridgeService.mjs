import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createSabrinaMemoryRecord } from "../../packages/sabrina-protocol/index.mjs";
import { resolveOpenClawStateDir } from "./OpenClawConfigCache.mjs";
import { sabrinaBrowserAgentId } from "./OpenClawAgentBootstrapService.mjs";

function resolveSabrinaMemoryPath() {
  return path.join(
    resolveOpenClawStateDir(),
    "workspaces",
    sabrinaBrowserAgentId,
    ".sabrina",
    "memory.json",
  );
}

async function readMemoryFile() {
  try {
    const raw = await fs.readFile(resolveSabrinaMemoryPath(), "utf8");
    const payload = JSON.parse(raw);
    return Array.isArray(payload?.records) ? payload.records : [];
  } catch {
    return [];
  }
}

async function writeMemoryFile(records) {
  const filePath = resolveSabrinaMemoryPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(
    filePath,
    JSON.stringify(
      {
        version: 1,
        records,
      },
      null,
      2,
    ),
    "utf8",
  );
}

function buildMemorySearchHaystack(record) {
  return [
    record?.url,
    record?.host,
    record?.title,
    record?.summary,
    ...(Array.isArray(record?.entities) ? record.entities : []),
    ...(Array.isArray(record?.keywords) ? record.keywords : []),
  ]
    .map((entry) => `${entry ?? ""}`.trim().toLowerCase())
    .filter(Boolean)
    .join("\n");
}

export async function saveBrowserMemoryRecord(input = {}) {
  const records = await readMemoryFile();
  const normalizedInput = {
    ...input,
    id: `${input?.id ?? ""}`.trim() || crypto.randomUUID(),
  };
  const nextRecord = createSabrinaMemoryRecord(normalizedInput);
  const nextRecords = records.filter((entry) => entry?.id !== nextRecord.id);
  nextRecords.unshift(nextRecord);
  await writeMemoryFile(nextRecords.slice(0, 500));
  return nextRecord;
}

export async function searchBrowserMemoryRecords(query = "", options = {}) {
  const normalizedQuery = `${query ?? ""}`.trim().toLowerCase();
  const limit = Number.isFinite(options?.limit) ? Math.max(1, Math.min(50, options.limit)) : 10;
  const records = await readMemoryFile();
  if (!normalizedQuery) {
    return records.slice(0, limit);
  }

  return records
    .filter((record) => buildMemorySearchHaystack(record).includes(normalizedQuery))
    .slice(0, limit);
}

export async function getBrowserMemoryStats() {
  const records = await readMemoryFile();
  return {
    path: resolveSabrinaMemoryPath(),
    count: records.length,
    latestCapturedAt: records[0]?.capturedAt ?? null,
  };
}

