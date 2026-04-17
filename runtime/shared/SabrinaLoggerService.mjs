import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const LOG_DIR = path.join(process.cwd(), "logs");
const EVENT_LOG_PATH = path.join(LOG_DIR, "runtime-events.log");
const SESSION_DIR = path.join(LOG_DIR, "sessions");

let initPromise = null;

async function ensureDir() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await fs.mkdir(LOG_DIR, { recursive: true });
    await fs.mkdir(SESSION_DIR, { recursive: true });
  })();
  return initPromise;
}

/**
 * 记录架构级运行时事件 (NDJSON 格式)
 */
export async function recordRuntimeEvent(type, detail = {}) {
  await ensureDir();
  const event = {
    timestamp: new Date().toISOString(),
    type,
    hostname: os.hostname(),
    pid: process.pid,
    ...detail
  };
  
  try {
    await fs.appendFile(EVENT_LOG_PATH, JSON.stringify(event) + "\n", "utf8");
  } catch (err) {
    console.error("[Logger] Failed to record runtime event:", err);
  }
}

/**
 * 存档完整会话数据
 */
export async function archiveSession(taskId, sessionData) {
  await ensureDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `${timestamp}-${taskId}.json`;
  const filePath = path.join(SESSION_DIR, fileName);
  
  const payload = {
    taskId,
    archivedAt: new Date().toISOString(),
    ...sessionData
  };
  
  try {
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
    await recordRuntimeEvent("session.archived", { taskId, fileName });
    return filePath;
  } catch (err) {
    console.error("[Logger] Failed to archive session:", err);
    await recordRuntimeEvent("session.archive_error", { taskId, error: err.message });
    return null;
  }
}

/**
 * 记录 RPC 延迟警报
 */
export async function recordRpcLatency(method, latencyMs) {
  if (latencyMs > 1000) {
    await recordRuntimeEvent("rpc.latency_alert", { method, latencyMs });
  }
}
