// Owns browser library state: history, bookmarks, downloads.
// All reads and writes go through here. Uses atomic rename for persistence.
import fs from "node:fs/promises";
import path from "node:path";
import { getBrowserUrlLabel } from "./BrowserUrlService.mjs";

const maxStoredHistoryEntries = 400;
const maxStoredDownloadEntries = 200;

let mainWindowGetter = () => null;
let resolveStatePath = () => path.join(process.cwd(), "browser-library.json");
let recordBrowserEvent = () => {};
let openLocalPath = async () => {
  throw new Error("浏览器宿主尚未初始化文件打开能力。");
};
let revealLocalPath = () => {
  throw new Error("浏览器宿主尚未初始化文件定位能力。");
};
let persistQueue = Promise.resolve();
let persistNonce = 0;

/** @type {{ history: object[], bookmarks: object[], downloads: object[] }} */
let state = { history: [], bookmarks: [], downloads: [] };

export function initLibraryStore(host = {}) {
  mainWindowGetter = typeof host?.getMainWindow === "function" ? host.getMainWindow : () => null;
  resolveStatePath =
    typeof host?.resolveStatePath === "function"
      ? host.resolveStatePath
      : () => path.join(process.cwd(), "browser-library.json");
  recordBrowserEvent = typeof host?.recordEvent === "function" ? host.recordEvent : () => {};
  openLocalPath = typeof host?.openPath === "function" ? host.openPath : openLocalPath;
  revealLocalPath =
    typeof host?.revealPath === "function" ? host.revealPath : revealLocalPath;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function createRecordId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createIsoTimestamp(input = Date.now()) {
  return new Date(input).toISOString();
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// ── Persistence ───────────────────────────────────────────────────────────────

async function readJsonFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeState(raw) {
  const history = Array.isArray(raw?.history)
    ? raw.history
        .filter((e) => isNonEmptyString(e?.url))
        .map((e) => ({
          id: isNonEmptyString(e?.id) ? e.id.trim() : createRecordId("history"),
          url: e.url.trim(),
          title: isNonEmptyString(e?.title) ? e.title.trim() : getBrowserUrlLabel(e.url),
          visitedAt: isNonEmptyString(e?.visitedAt) ? e.visitedAt.trim() : createIsoTimestamp(),
        }))
        .slice(0, maxStoredHistoryEntries)
    : [];

  const bookmarks = Array.isArray(raw?.bookmarks)
    ? raw.bookmarks
        .filter((e) => isNonEmptyString(e?.url))
        .map((e) => ({
          id: isNonEmptyString(e?.id) ? e.id.trim() : createRecordId("bookmark"),
          url: e.url.trim(),
          title: isNonEmptyString(e?.title) ? e.title.trim() : getBrowserUrlLabel(e.url),
          addedAt: isNonEmptyString(e?.addedAt) ? e.addedAt.trim() : createIsoTimestamp(),
        }))
    : [];

  const downloads = Array.isArray(raw?.downloads)
    ? raw.downloads
        .filter((e) => isNonEmptyString(e?.fileName) || isNonEmptyString(e?.url))
        .map((e) => ({
          id: isNonEmptyString(e?.id) ? e.id.trim() : createRecordId("download"),
          url: isNonEmptyString(e?.url) ? e.url.trim() : "",
          fileName: isNonEmptyString(e?.fileName) ? e.fileName.trim() : getBrowserUrlLabel(`${e?.url ?? ""}`),
          mimeType: isNonEmptyString(e?.mimeType) ? e.mimeType.trim() : "",
          savePath: isNonEmptyString(e?.savePath) ? e.savePath.trim() : "",
          receivedBytes: Number.isFinite(e?.receivedBytes) ? Number(e.receivedBytes) : 0,
          totalBytes: Number.isFinite(e?.totalBytes) ? Number(e.totalBytes) : 0,
          state:
            e?.state === "completed" || e?.state === "cancelled" || e?.state === "interrupted"
              ? e.state
              : "progressing",
          paused: Boolean(e?.paused),
          tabId: isNonEmptyString(e?.tabId) ? e.tabId.trim() : null,
          startedAt: isNonEmptyString(e?.startedAt) ? e.startedAt.trim() : createIsoTimestamp(),
          updatedAt: isNonEmptyString(e?.updatedAt) ? e.updatedAt.trim() : createIsoTimestamp(),
        }))
        .slice(0, maxStoredDownloadEntries)
    : [];

  return { history, bookmarks, downloads };
}

export async function loadBrowserLibraryState() {
  const raw = await readJsonFile(resolveStatePath());
  state = normalizeState(raw);
}

// Atomic write: write to .tmp then rename to avoid partial-write corruption.
async function persistBrowserLibraryState() {
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
      recordBrowserEvent("error", "browser", "持久化浏览器库状态失败", {
        source: "main",
        kind: "browser-library-persist-failure",
        details: { message: error instanceof Error ? error.message : String(error) },
      });
    }
  });

  persistQueue = queuedPersist;
  return queuedPersist;
}

export function serializeLibraryState() {
  return {
    history: state.history.map((e) => ({ ...e })),
    bookmarks: state.bookmarks.map((e) => ({ ...e })),
    downloads: state.downloads.map((e) => ({ ...e })),
  };
}

function emitLibraryState() {
  const win = mainWindowGetter();
  if (!win || win.isDestroyed()) return;
  win.webContents.send("browser:library-state", serializeLibraryState());
}

// ── History ───────────────────────────────────────────────────────────────────

function shouldTrackHistoryUrl(url) {
  return /^https?:/i.test(`${url ?? ""}`.trim());
}

export function updateStoredEntryTitle(url, title) {
  if (!isNonEmptyString(url) || !isNonEmptyString(title)) return;
  const normalizedUrl = url.trim();
  const normalizedTitle = title.trim();
  let changed = false;

  const nextHistory = state.history.map((e, i) => {
    if (i !== 0 || e.url !== normalizedUrl || e.title === normalizedTitle) return e;
    changed = true;
    return { ...e, title: normalizedTitle };
  });

  const nextBookmarks = state.bookmarks.map((e) => {
    if (e.url !== normalizedUrl || e.title === normalizedTitle) return e;
    changed = true;
    return { ...e, title: normalizedTitle };
  });

  if (!changed) return;
  state = { ...state, history: nextHistory, bookmarks: nextBookmarks };
  void persistBrowserLibraryState();
  emitLibraryState();
}

export function recordHistoryVisit(tab) {
  if (!shouldTrackHistoryUrl(tab?.url)) return;

  const entry = {
    id: createRecordId("history"),
    url: tab.url,
    title: `${tab.title || getBrowserUrlLabel(tab.url)}`.trim() || getBrowserUrlLabel(tab.url),
    visitedAt: createIsoTimestamp(),
  };
  const latest = state.history[0];

  if (latest?.url === entry.url) {
    state = {
      ...state,
      history: [{ ...latest, title: entry.title, visitedAt: entry.visitedAt }, ...state.history.slice(1)],
    };
  } else {
    state = {
      ...state,
      history: [entry, ...state.history].slice(0, maxStoredHistoryEntries),
    };
  }

  void persistBrowserLibraryState();
  emitLibraryState();
}

// Clears history data only. Caller is responsible for clearing webContents navigation history.
export function clearHistoryData() {
  state = { ...state, history: [] };
  void persistBrowserLibraryState();
  emitLibraryState();
  return serializeLibraryState();
}

// ── Bookmarks ─────────────────────────────────────────────────────────────────

export function toggleBookmarkRecord(payload) {
  const url = `${payload?.url ?? ""}`.trim();
  if (!url) return serializeLibraryState();

  const existing = state.bookmarks.find((e) => e.url === url);
  if (existing) {
    state = { ...state, bookmarks: state.bookmarks.filter((e) => e.url !== url) };
  } else {
    state = {
      ...state,
      bookmarks: [
        {
          id: createRecordId("bookmark"),
          url,
          title: `${payload?.title ?? ""}`.trim() || getBrowserUrlLabel(url),
          addedAt: createIsoTimestamp(),
        },
        ...state.bookmarks,
      ],
    };
  }

  void persistBrowserLibraryState();
  emitLibraryState();
  return serializeLibraryState();
}

export function removeBookmarkRecord(payload) {
  const url = `${payload?.url ?? ""}`.trim();
  if (!url) return serializeLibraryState();

  const next = state.bookmarks.filter((e) => e.url !== url);
  if (next.length === state.bookmarks.length) return serializeLibraryState();

  state = { ...state, bookmarks: next };
  void persistBrowserLibraryState();
  emitLibraryState();
  return serializeLibraryState();
}

// ── Downloads ─────────────────────────────────────────────────────────────────

function resolveDownloadEntry(downloadId) {
  return state.downloads.find((e) => e.id === downloadId) ?? null;
}

function upsertDownloadEntry(entry) {
  const idx = state.downloads.findIndex((e) => e.id === entry.id);
  const next = [...state.downloads];
  if (idx >= 0) {
    next[idx] = entry;
  } else {
    next.unshift(entry);
  }
  state = { ...state, downloads: next.slice(0, maxStoredDownloadEntries) };
  void persistBrowserLibraryState();
  emitLibraryState();
}

function buildDownloadEntry(item, downloadId, tabId = null) {
  const startTime = Number(item.getStartTime?.() ?? 0);
  return {
    id: downloadId,
    url: `${item.getURL?.() ?? ""}`.trim(),
    fileName: item.getFilename()?.trim() || getBrowserUrlLabel(item.getURL()),
    mimeType: `${item.getMimeType?.() ?? ""}`.trim(),
    savePath: `${item.getSavePath?.() ?? ""}`.trim(),
    receivedBytes: Number(item.getReceivedBytes?.() ?? 0),
    totalBytes: Number(item.getTotalBytes?.() ?? 0),
    state: item.getState(),
    paused: Boolean(item.isPaused?.()),
    tabId,
    startedAt: startTime > 0 ? createIsoTimestamp(startTime * 1000) : createIsoTimestamp(),
    updatedAt: createIsoTimestamp(),
  };
}

export function bindDownloadTracking(targetSession, getTabIdByWebContentsId) {
  targetSession.on("will-download", (_event, item, webContents) => {
    const tabId = webContents ? (getTabIdByWebContentsId(webContents.id) ?? null) : null;
    const downloadId = createRecordId("download");

    recordBrowserEvent("info", "browser", "开始下载文件", {
      source: "main",
      tabId,
      url: item.getURL?.() ?? "",
      kind: "download-started",
      details: { downloadId, fileName: item.getFilename?.() ?? "", mimeType: item.getMimeType?.() ?? "" },
    });

    upsertDownloadEntry(buildDownloadEntry(item, downloadId, tabId));

    item.on("updated", (_e, downloadState) => {
      upsertDownloadEntry({ ...buildDownloadEntry(item, downloadId, tabId), state: downloadState });
    });

    item.once("done", (_e, downloadState) => {
      upsertDownloadEntry({ ...buildDownloadEntry(item, downloadId, tabId), state: downloadState });
      recordBrowserEvent(
        downloadState === "completed" ? "info" : "warn",
        "browser",
        downloadState === "completed" ? "下载完成" : "下载未完成",
        {
          source: "main",
          tabId,
          url: item.getURL?.() ?? "",
          kind: downloadState === "completed" ? "download-completed" : "download-finished",
          details: {
            downloadId,
            fileName: item.getFilename?.() ?? "",
            savePath: item.getSavePath?.() ?? "",
            state: downloadState,
          },
        },
      );
    });
  });
}

export async function openDownloadRecord(payload) {
  const entry = resolveDownloadEntry(`${payload?.downloadId ?? ""}`.trim());
  if (!entry?.savePath) throw new Error("该下载尚未生成本地文件。");
  await openLocalPath(entry.savePath);
}

export function revealDownloadRecord(payload) {
  const entry = resolveDownloadEntry(`${payload?.downloadId ?? ""}`.trim());
  if (!entry?.savePath) throw new Error("该下载尚未生成本地文件。");
  revealLocalPath(entry.savePath);
}
