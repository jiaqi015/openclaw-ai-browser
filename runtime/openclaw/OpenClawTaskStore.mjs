import fs from "node:fs/promises";
import path from "node:path";

const maxStoredTasks = 200;

let mainWindowGetter = () => null;
let resolveStatePath = () => path.join(process.cwd(), "openclaw-tasks.json");
let recordOpenClawEvent = () => {};
let persistQueue = Promise.resolve();
let persistNonce = 0;
let state = { tasks: [] };

export function initOpenClawTaskStore(host = {}) {
  mainWindowGetter = typeof host?.getMainWindow === "function" ? host.getMainWindow : () => null;
  resolveStatePath =
    typeof host?.resolveStatePath === "function"
      ? host.resolveStatePath
      : () => path.join(process.cwd(), "openclaw-tasks.json");
  recordOpenClawEvent = typeof host?.recordEvent === "function" ? host.recordEvent : () => {};
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function createTaskId() {
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createIsoTimestamp(input = Date.now()) {
  return new Date(input).toISOString();
}

async function readJsonFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeTaskRecord(rawTask) {
  const createdAt = isNonEmptyString(rawTask?.createdAt)
    ? rawTask.createdAt.trim()
    : createIsoTimestamp();

  return {
    taskId: isNonEmptyString(rawTask?.taskId) ? rawTask.taskId.trim() : createTaskId(),
    kind: isNonEmptyString(rawTask?.kind) ? rawTask.kind.trim() : "handoff",
    agentId: isNonEmptyString(rawTask?.agentId) ? rawTask.agentId.trim() : "main",
    title: isNonEmptyString(rawTask?.title) ? rawTask.title.trim() : "龙虾异步任务",
    promptPreview: isNonEmptyString(rawTask?.promptPreview) ? rawTask.promptPreview.trim() : "",
    sourceUrl: isNonEmptyString(rawTask?.sourceUrl) ? rawTask.sourceUrl.trim() : "",
    threadId: isNonEmptyString(rawTask?.threadId) ? rawTask.threadId.trim() : "",
    sessionId: isNonEmptyString(rawTask?.sessionId) ? rawTask.sessionId.trim() : "",
    model: isNonEmptyString(rawTask?.model) ? rawTask.model.trim() : "",
    status:
      rawTask?.status === "failed" || rawTask?.status === "running"
        ? rawTask.status
        : "completed",
    responseText: typeof rawTask?.responseText === "string" ? rawTask.responseText : "",
    errorMessage: isNonEmptyString(rawTask?.errorMessage) ? rawTask.errorMessage.trim() : "",
    createdAt,
    updatedAt: isNonEmptyString(rawTask?.updatedAt)
      ? rawTask.updatedAt.trim()
      : createdAt,
    durationMs: Number.isFinite(rawTask?.durationMs) ? Number(rawTask.durationMs) : null,
  };
}

function normalizeTaskState(rawState) {
  return {
    tasks: (Array.isArray(rawState?.tasks) ? rawState.tasks : [])
      .map((task) => normalizeTaskRecord(task))
      .slice(0, maxStoredTasks),
  };
}

async function persistTaskState() {
  const filePath = resolveStatePath();
  const payload = JSON.stringify(state, null, 2);
  const queuedPersist = persistQueue.catch(() => {}).then(async () => {
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}-${persistNonce++}.tmp`;

    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(tmpPath, payload, "utf8");
      await fs.rename(tmpPath, filePath);
    } catch (error) {
      await fs.rm(tmpPath, { force: true }).catch(() => {});
      recordOpenClawEvent("error", "openclaw", "持久化 OpenClaw 任务失败", {
        source: "main",
        kind: "openclaw-task-persist-failure",
        details: { message: error instanceof Error ? error.message : String(error) },
      });
    }
  });

  persistQueue = queuedPersist;
  return queuedPersist;
}

export async function loadOpenClawTaskState() {
  const raw = await readJsonFile(resolveStatePath());
  state = normalizeTaskState(raw);
}

export function serializeOpenClawTaskState() {
  return {
    tasks: state.tasks.map((task) => ({ ...task })),
  };
}

export function emitOpenClawTaskState() {
  const win = mainWindowGetter();
  if (!win || win.isDestroyed()) {
    return;
  }

  win.webContents.send("openclaw:task-state", serializeOpenClawTaskState());
}

export async function recordOpenClawTask(task) {
  const normalizedTask = normalizeTaskRecord(task);
  state = {
    tasks: [normalizedTask, ...state.tasks].slice(0, maxStoredTasks),
  };
  await persistTaskState();
  emitOpenClawTaskState();
  return normalizedTask;
}
