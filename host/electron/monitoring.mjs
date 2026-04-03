import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { app, shell } from "electron";
import log from "electron-log/main.js";
import {
  CONSOLE_LEVEL_MAP,
  DEFAULT_ENTRY_LIMIT,
  DEFAULT_NETWORK_LIMIT,
  MAX_RECENT_NETWORK,
  STRUCTURED_LOG_FILE,
  buildMonitorEntry,
  createEmptyAiStats,
  createEmptyCounters,
  pushBounded,
  safeError,
  safeValue,
} from "./MonitorShared.mjs";
import { bindSessionMonitoring as bindNetworkSessionMonitoring } from "./MonitorNetworkTracker.mjs";
import {
  buildDiagnosticsState,
  readStructuredEntries,
} from "./MonitorStateSnapshot.mjs";

let startedAtMs = Date.now();
let recentEntries = [];
let recentNetwork = [];
let diagnosticsCounters = createEmptyCounters();
let aiStats = createEmptyAiStats();
let mainWindowGetter = () => null;
let tabSnapshotGetter = () => ({
  activeTabId: null,
  activeTabUrl: "",
  tabCount: 0,
});
let tabIdResolver = () => null;
let logsDir = "";
let humanLogPath = "";
let structuredLogPath = "";
let updateTimer = null;
let initialized = false;

function updateCounters(entry) {
  diagnosticsCounters.total += 1;
  diagnosticsCounters[entry.level] =
    (diagnosticsCounters[entry.level] ?? 0) + 1;

  if (entry.source === "renderer" && entry.level === "error") {
    diagnosticsCounters.rendererErrors += 1;
  }

  if (entry.kind === "guest-crash") {
    diagnosticsCounters.guestCrashes += 1;
  }

  if (entry.kind === "network-failure") {
    diagnosticsCounters.networkFailures += 1;
  }
}

function appendStructuredEntry(entry) {
  if (!structuredLogPath) {
    return;
  }

  try {
    fs.mkdirSync(path.dirname(structuredLogPath), { recursive: true });
    fs.appendFileSync(structuredLogPath, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (error) {
    log.error("追加结构化日志失败", safeError(error));
  }
}

function buildState({ entryLimit, networkLimit } = {}) {
  return buildDiagnosticsState({
    appName: app.getName(),
    appVersion: app.getVersion(),
    isPackaged: app.isPackaged,
    startedAtMs,
    logsDir,
    humanLogPath,
    structuredLogPath,
    diagnosticsCounters,
    aiStats,
    browserSnapshot: tabSnapshotGetter(),
    recentEntries,
    recentNetwork,
    entryLimit,
    networkLimit,
  });
}

function emitUpdateSoon() {
  if (updateTimer) {
    return;
  }

  updateTimer = setTimeout(() => {
    updateTimer = null;
    const mainWindow = mainWindowGetter();
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    mainWindow.webContents.send(
      "monitor:state",
      getDiagnosticsState({
        entryLimit: DEFAULT_ENTRY_LIMIT,
        networkLimit: DEFAULT_NETWORK_LIMIT,
      }),
    );
  }, 120);
}

function logToHumanFile(level, scope, message, details, tabId, url) {
  const logger = scope ? log.scope(scope) : log;
  const suffix = [tabId ? `tab=${tabId}` : "", url ? `url=${url}` : ""]
    .filter(Boolean)
    .join(" ");
  const line = suffix ? `${message} (${suffix})` : message;

  if (details === undefined) {
    logger[level](line);
    return;
  }

  logger[level](line, safeValue(details));
}

function pushEntry(entry, shouldWriteFile = true) {
  updateCounters(entry);
  pushBounded(recentEntries, entry, 240);
  if (shouldWriteFile) {
    appendStructuredEntry(entry);
  }
  emitUpdateSoon();
  return entry;
}

export function recordMonitorEvent(
  level,
  scope,
  message,
  { source = "main", details, tabId = null, url = "", kind = "" } = {},
) {
  const entry = buildMonitorEntry({
    level,
    scope,
    source,
    message,
    details,
    tabId,
    url,
    kind,
  });

  logToHumanFile(level, scope, message, details, tabId, url);
  return pushEntry(entry);
}

export function recordAiTurn({
  action,
  agentId,
  model,
  durationMs,
  ok,
  tabId = null,
  errorMessage = "",
  sessionId = "",
  promptChars = 0,
  responseChars = 0,
}) {
  aiStats.total += 1;
  aiStats.lastAction = action || "";
  aiStats.lastAgentId = agentId || "";
  aiStats.lastModel = model || "";
  aiStats.lastDurationMs = durationMs || 0;
  aiStats.lastFinishedAt = new Date().toISOString();

  if (ok) {
    aiStats.success += 1;
    diagnosticsCounters.aiSuccess += 1;
    const nextAverage =
      aiStats.success === 1
        ? durationMs || 0
        : Math.round(
            (aiStats.avgDurationMs * (aiStats.success - 1) + (durationMs || 0)) /
              aiStats.success,
          );
    aiStats.avgDurationMs = nextAverage;
    aiStats.lastError = "";
  } else {
    aiStats.failure += 1;
    diagnosticsCounters.aiFailures += 1;
    aiStats.lastError = errorMessage || "AI 请求失败";
  }

  return recordMonitorEvent(
    ok ? "info" : "error",
    "ai",
    ok ? "AI 调用完成" : "AI 调用失败",
    {
      source: "main",
      tabId,
      kind: ok ? "ai-success" : "ai-failure",
      details: {
        action,
        agentId,
        model,
        durationMs,
        ok,
        errorMessage,
        sessionId,
        promptChars,
        responseChars,
      },
    },
  );
}

function pushNetworkEvent(event) {
  pushBounded(recentNetwork, event, MAX_RECENT_NETWORK);
  emitUpdateSoon();
}

export function bindSessionMonitoring(targetSession) {
  bindNetworkSessionMonitoring(targetSession, {
    resolveTabIdByWebContentsId: tabIdResolver,
    pushNetworkEvent,
    recordMonitorEvent,
  });
}

export function bindGuestContents(tabId, contents) {
  contents.on("console-message", (_event, details) => {
    const mappedLevel = CONSOLE_LEVEL_MAP[details.level] ?? "info";
    if (mappedLevel === "info" || mappedLevel === "debug") {
      return;
    }

    recordMonitorEvent(mappedLevel, "guest-console", "网页控制台告警", {
      source: "guest",
      tabId,
      url: contents.getURL?.() ?? "",
      details: {
        level: details.level,
        message: details.message,
        line: details.lineNumber,
        sourceId: details.sourceId,
        frameUrl: details.frame?.url ?? "",
      },
    });
  });

  contents.on("unresponsive", () => {
    recordMonitorEvent("warn", "browser", "网页渲染进程无响应", {
      source: "guest",
      tabId,
      url: contents.getURL?.() ?? "",
      kind: "guest-unresponsive",
    });
  });

  contents.on("responsive", () => {
    recordMonitorEvent("info", "browser", "网页渲染进程恢复响应", {
      source: "guest",
      tabId,
      url: contents.getURL?.() ?? "",
    });
  });

  contents.on("preload-error", (_event, preloadPath, error) => {
    recordMonitorEvent("error", "browser", "网页 preload 执行失败", {
      source: "guest",
      tabId,
      url: contents.getURL?.() ?? "",
      kind: "guest-preload-error",
      details: {
        preloadPath,
        error: safeError(error),
      },
    });
  });
}

export function bindRendererWindowContents(contents) {
  contents.on("render-process-gone", (_event, details) => {
    recordMonitorEvent("error", "renderer", "应用渲染进程退出", {
      source: "renderer",
      kind: "renderer-process-gone",
      details,
    });
  });

  contents.on("unresponsive", () => {
    recordMonitorEvent("warn", "renderer", "应用界面无响应", {
      source: "renderer",
      kind: "renderer-unresponsive",
    });
  });

  contents.on("responsive", () => {
    recordMonitorEvent("info", "renderer", "应用界面恢复响应", {
      source: "renderer",
    });
  });
}

export function captureRendererEvent(payload = {}) {
  const level =
    payload.level === "warn" || payload.level === "error"
      ? payload.level
      : "info";
  const message = `${payload.message ?? ""}`.trim() || "渲染层事件";

  return recordMonitorEvent(level, payload.scope || "renderer", message, {
    source: "renderer",
    tabId: typeof payload.tabId === "string" ? payload.tabId : null,
    url: typeof payload.url === "string" ? payload.url : "",
    kind: typeof payload.kind === "string" ? payload.kind : "",
    details: payload.details,
  });
}

export function getDiagnosticsState(options) {
  return buildState(options);
}

export async function openLogDirectory() {
  if (!logsDir) {
    return;
  }
  await shell.openPath(logsDir);
}

export function revealHumanLogFile() {
  if (!humanLogPath) {
    return;
  }
  shell.showItemInFolder(humanLogPath);
}

export async function initializeMonitoring({
  getMainWindow,
  resolveTabIdByWebContentsId,
  getTabSnapshot,
  session,
}) {
  if (initialized) {
    return;
  }

  initialized = true;
  startedAtMs = Date.now();
  mainWindowGetter =
    typeof getMainWindow === "function" ? getMainWindow : () => null;
  tabIdResolver =
    typeof resolveTabIdByWebContentsId === "function"
      ? resolveTabIdByWebContentsId
      : () => null;
  tabSnapshotGetter =
    typeof getTabSnapshot === "function"
      ? getTabSnapshot
      : () => ({
          activeTabId: null,
          activeTabUrl: "",
          tabCount: 0,
        });

  app.setAppLogsPath();
  logsDir = app.getPath("logs");

  log.initialize();
  log.transports.file.level = "debug";
  log.transports.file.maxSize = 5 * 1024 * 1024;
  log.transports.file.resolvePathFn = () => path.join(logsDir, "main.log");
  log.transports.console.level = app.isPackaged ? "info" : "debug";

  humanLogPath = log.transports.file.getFile().path;
  structuredLogPath = path.join(logsDir, STRUCTURED_LOG_FILE);

  await fsp.mkdir(logsDir, { recursive: true });
  recentEntries = await readStructuredEntries(structuredLogPath);
  recentNetwork = [];

  log.errorHandler.startCatching({
    showDialog: false,
    onError({ error, errorName, processType, versions }) {
      recordMonitorEvent("error", "system", `${errorName} (${processType})`, {
        source: processType === "renderer" ? "renderer" : "main",
        kind: processType === "renderer" ? "renderer-unhandled" : "main-unhandled",
        details: {
          error: safeError(error),
          versions,
        },
      });
    },
  });

  bindSessionMonitoring(session);

  recordMonitorEvent("info", "system", "本地监控系统已启动", {
    source: "main",
    details: {
      logDir: logsDir,
      humanLogPath,
      structuredLogPath,
    },
  });
}
