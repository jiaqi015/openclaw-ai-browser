import fs from "node:fs/promises";
import path from "node:path";
import { normalizePageKey, resolveThreadRuntime } from "./ThreadResolver.mjs";

let mainWindowGetter = () => null;
let resolveStatePath = () => path.join(process.cwd(), "thread-state.json");
let recordThreadEvent = () => {};
let persistQueue = Promise.resolve();
let persistNonce = 0;

let state = {
  threadsById: {},
  threadOrder: [],
  messagesByThreadId: {},
  pageThreadIds: {},
};
let runtimeTabThreads = {};

export function initThreadStore(host = {}) {
  mainWindowGetter = typeof host?.getMainWindow === "function" ? host.getMainWindow : () => null;
  resolveStatePath =
    typeof host?.resolveStatePath === "function"
      ? host.resolveStatePath
      : () => path.join(process.cwd(), "thread-state.json");
  recordThreadEvent = typeof host?.recordEvent === "function" ? host.recordEvent : () => {};
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function createFallbackId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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

function normalizeMessageRecord(rawMessage) {
  const text = typeof rawMessage?.text === "string" ? rawMessage.text : "";
  if (!text.trim()) {
    return null;
  }

  const role =
    rawMessage?.role === "user" ||
    rawMessage?.role === "assistant" ||
    rawMessage?.role === "system" ||
    rawMessage?.role === "error"
      ? rawMessage.role
      : "assistant";

  const normalizedMessage = {
    messageId: isNonEmptyString(rawMessage?.messageId)
      ? rawMessage.messageId.trim()
      : createFallbackId("msg"),
    role,
    text,
  };

  if (rawMessage?.skillTrace && typeof rawMessage.skillTrace === "object") {
    normalizedMessage.skillTrace = rawMessage.skillTrace;
  }

  return normalizedMessage;
}

function normalizeThreadRecord(rawThread, threadId) {
  return {
    threadId,
    title: isNonEmptyString(rawThread?.title) ? rawThread.title.trim() : "当前页面",
    originUrl: isNonEmptyString(rawThread?.originUrl) ? rawThread.originUrl.trim() : "about:blank",
    pageKey: isNonEmptyString(rawThread?.pageKey) ? rawThread.pageKey.trim() : null,
    siteHost: isNonEmptyString(rawThread?.siteHost) ? rawThread.siteHost.trim() : "",
    siteLabel: isNonEmptyString(rawThread?.siteLabel) ? rawThread.siteLabel.trim() : "当前页面",
    updatedAt: isNonEmptyString(rawThread?.updatedAt)
      ? rawThread.updatedAt.trim()
      : createIsoTimestamp(),
  };
}

function normalizeThreadState(rawState) {
  const nextThreadsById = {};
  const nextMessagesByThreadId = {};

  for (const [rawThreadId, rawThread] of Object.entries(rawState?.threadsById ?? {})) {
    const threadId = `${rawThreadId ?? ""}`.trim();
    if (!threadId) {
      continue;
    }

    nextThreadsById[threadId] = normalizeThreadRecord(rawThread, threadId);
    const normalizedMessages = (
      Array.isArray(rawState?.messagesByThreadId?.[threadId])
        ? rawState.messagesByThreadId[threadId]
        : []
    )
      .map((message) => normalizeMessageRecord(message))
      .filter(Boolean);

    nextMessagesByThreadId[threadId] = normalizedMessages;
  }

  const threadOrder = Array.isArray(rawState?.threadOrder)
    ? rawState.threadOrder
        .map((threadId) => `${threadId ?? ""}`.trim())
        .filter((threadId) => threadId && nextThreadsById[threadId])
    : [];

  for (const threadId of Object.keys(nextThreadsById)) {
    if (!threadOrder.includes(threadId)) {
      threadOrder.push(threadId);
    }
  }

  const pageThreadIds = {};
  for (const [pageKey, threadId] of Object.entries(rawState?.pageThreadIds ?? {})) {
    const normalizedPageKey = `${pageKey ?? ""}`.trim();
    const normalizedThreadId = `${threadId ?? ""}`.trim();
    if (!normalizedPageKey || !normalizedThreadId || !nextThreadsById[normalizedThreadId]) {
      continue;
    }

    pageThreadIds[normalizedPageKey] = normalizedThreadId;
  }

  return {
    threadsById: nextThreadsById,
    threadOrder,
    messagesByThreadId: nextMessagesByThreadId,
    pageThreadIds,
  };
}

async function persistThreadState() {
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
      recordThreadEvent("error", "thread", "持久化 thread 历史失败", {
        source: "main",
        kind: "thread-store-persist-failure",
        details: { message: error instanceof Error ? error.message : String(error) },
      });
    }
  });

  persistQueue = queuedPersist;
  return queuedPersist;
}

export async function loadThreadStoreState() {
  const raw = await readJsonFile(resolveStatePath());
  state = normalizeThreadState(raw);
  runtimeTabThreads = {};
}

export function serializeThreadStoreState() {
  return {
    threadsById: Object.fromEntries(
      Object.entries(state.threadsById).map(([threadId, thread]) => [threadId, { ...thread }]),
    ),
    threadOrder: [...state.threadOrder],
    messagesByThreadId: Object.fromEntries(
      Object.entries(state.messagesByThreadId).map(([threadId, messages]) => [
        threadId,
        messages.map((message) => ({ ...message })),
      ]),
    ),
    pageThreadIds: { ...state.pageThreadIds },
  };
}

export function serializeThreadRuntimeState() {
  return {
    state: serializeThreadStoreState(),
    tabThreads: { ...runtimeTabThreads },
  };
}

export function emitThreadRuntimeState() {
  const win = mainWindowGetter();
  if (!win || win.isDestroyed()) {
    return;
  }

  win.webContents.send("thread:runtime-state", serializeThreadRuntimeState());
}

export async function reconcileThreadStoreWithTabs(tabs = []) {
  return resolveThreadStoreRuntime({
    state,
    tabThreads: runtimeTabThreads,
    tabs,
  });
}

function touchThreadOrder(order, threadId) {
  return [threadId, ...order.filter((entry) => entry !== threadId)];
}

function getStateSignature(input) {
  return JSON.stringify(input);
}

async function commitThreadStoreUpdate(nextState, nextTabThreads = runtimeTabThreads) {
  const previousSignature = getStateSignature(state);
  const previousRuntimeSignature = getStateSignature(runtimeTabThreads);
  const nextSignature = getStateSignature(nextState);
  const nextRuntimeSignature = getStateSignature(nextTabThreads);

  state = nextState;
  runtimeTabThreads = nextTabThreads;

  if (previousSignature !== nextSignature) {
    await persistThreadState();
  }
  if (previousSignature !== nextSignature || previousRuntimeSignature !== nextRuntimeSignature) {
    emitThreadRuntimeState();
  }

  return serializeThreadRuntimeState();
}

export async function resolveThreadStoreRuntime(payload = {}) {
  const baseState = normalizeThreadState(payload?.state ?? state);
  const currentTabThreads = payload?.tabThreads ?? runtimeTabThreads;
  const resolution = resolveThreadRuntime({
    state: baseState,
    tabThreads: currentTabThreads,
    tabs: payload?.tabs ?? [],
  });
  const nextState = normalizeThreadState(resolution.state);
  return commitThreadStoreUpdate(nextState, resolution.tabThreads);
}

export async function selectThreadForTab(payload = {}) {
  const threadId = `${payload?.threadId ?? ""}`.trim();
  const tabId = `${payload?.tabId ?? ""}`.trim();
  const url = `${payload?.url ?? ""}`.trim();

  if (!threadId || !tabId || !state.threadsById[threadId]) {
    return serializeThreadRuntimeState();
  }

  const nextState = normalizeThreadState({
    ...state,
    threadOrder: touchThreadOrder(state.threadOrder, threadId),
  });
  const nextTabThreads = {
    ...runtimeTabThreads,
    [tabId]: {
      threadId,
      url,
      pageKey: normalizePageKey(url),
    },
  };

  return commitThreadStoreUpdate(nextState, nextTabThreads);
}

export async function appendMessageToThread(payload = {}) {
  const threadId = `${payload?.threadId ?? ""}`.trim();
  const message = normalizeMessageRecord(payload?.message);

  if (!threadId || !state.threadsById[threadId] || !message) {
    return serializeThreadRuntimeState();
  }

  const nextState = normalizeThreadState({
    ...state,
    threadsById: {
      ...state.threadsById,
      [threadId]: {
        ...state.threadsById[threadId],
        updatedAt: createIsoTimestamp(),
      },
    },
    messagesByThreadId: {
      ...state.messagesByThreadId,
      [threadId]: [...(state.messagesByThreadId[threadId] ?? []), message],
    },
    threadOrder: touchThreadOrder(state.threadOrder, threadId),
  });

  return commitThreadStoreUpdate(nextState);
}
