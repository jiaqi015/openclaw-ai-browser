import fsp from "node:fs/promises";
import os from "node:os";
import {
  DEFAULT_ENTRY_LIMIT,
  DEFAULT_NETWORK_LIMIT,
  MAX_RECENT_ENTRIES,
  formatBytes,
  formatLocalTimestamp,
} from "./MonitorShared.mjs";

function getMemorySummary() {
  const memoryUsage = process.memoryUsage();

  return {
    rssBytes: memoryUsage.rss,
    heapUsedBytes: memoryUsage.heapUsed,
    heapTotalBytes: memoryUsage.heapTotal,
    freeSystemMemoryBytes: os.freemem(),
    totalSystemMemoryBytes: os.totalmem(),
    formatted: {
      rss: formatBytes(memoryUsage.rss),
      heapUsed: formatBytes(memoryUsage.heapUsed),
      heapTotal: formatBytes(memoryUsage.heapTotal),
      freeSystem: formatBytes(os.freemem()),
      totalSystem: formatBytes(os.totalmem()),
    },
    extra: null,
  };
}

export function buildDiagnosticsState({
  appName,
  appVersion,
  isPackaged,
  startedAtMs,
  logsDir,
  humanLogPath,
  structuredLogPath,
  diagnosticsCounters,
  aiStats,
  browserSnapshot,
  recentEntries,
  recentNetwork,
  entryLimit = DEFAULT_ENTRY_LIMIT,
  networkLimit = DEFAULT_NETWORK_LIMIT,
}) {
  return {
    summary: {
      appName,
      appVersion,
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
      platform: process.platform,
      arch: process.arch,
      isPackaged,
      startedAt: new Date(startedAtMs).toISOString(),
      startedAtLabel: formatLocalTimestamp(startedAtMs),
      uptimeSec: Math.max(0, Math.round((Date.now() - startedAtMs) / 1000)),
      logDir: logsDir,
      humanLogPath,
      structuredLogPath,
      counters: diagnosticsCounters,
      ai: aiStats,
      browser: browserSnapshot,
      memory: getMemorySummary(),
    },
    entries: recentEntries.slice(-entryLimit).reverse(),
    network: recentNetwork.slice(-networkLimit).reverse(),
  };
}

export async function readStructuredEntries(
  structuredLogPath,
  limit = MAX_RECENT_ENTRIES,
) {
  if (!structuredLogPath) {
    return [];
  }

  try {
    const raw = await fsp.readFile(structuredLogPath, "utf8");
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-limit)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}
