export const MAX_RECENT_ENTRIES = 240;
export const MAX_RECENT_NETWORK = 120;
export const DEFAULT_ENTRY_LIMIT = 180;
export const DEFAULT_NETWORK_LIMIT = 60;
export const STRUCTURED_LOG_FILE = "monitor.ndjson";
export const CONSOLE_LEVEL_MAP = {
  debug: "debug",
  info: "info",
  warning: "warn",
  error: "error",
};

export function createEmptyCounters() {
  return {
    total: 0,
    error: 0,
    warn: 0,
    info: 0,
    rendererErrors: 0,
    guestCrashes: 0,
    networkFailures: 0,
    aiFailures: 0,
    aiSuccess: 0,
  };
}

export function createEmptyAiStats() {
  return {
    total: 0,
    success: 0,
    failure: 0,
    lastAction: "",
    lastAgentId: "",
    lastModel: "",
    lastDurationMs: 0,
    avgDurationMs: 0,
    lastError: "",
    lastFinishedAt: "",
  };
}

function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function pushBounded(list, item, max) {
  list.push(item);
  if (list.length > max) {
    list.splice(0, list.length - max);
  }
}

export function safeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: "UnknownError",
    message: `${error ?? ""}`.trim() || "未知错误",
  };
}

export function safeValue(input) {
  const seen = new WeakSet();

  return JSON.parse(
    JSON.stringify(input, (_key, value) => {
      if (value instanceof Error) {
        return safeError(value);
      }

      if (typeof value === "bigint") {
        return `${value}n`;
      }

      if (typeof value === "function") {
        return `[Function ${value.name || "anonymous"}]`;
      }

      if (typeof value === "string") {
        if (value.length > 4000) {
          return `${value.slice(0, 4000)}…`;
        }
        return value;
      }

      if (value && typeof value === "object") {
        if (seen.has(value)) {
          return "[Circular]";
        }
        seen.add(value);
      }

      return value;
    }),
  );
}

export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatLocalTimestamp(input) {
  const date = typeof input === "number" ? new Date(input) : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function buildMonitorEntry({
  level = "info",
  scope = "system",
  source = "main",
  message,
  details,
  tabId = null,
  url = "",
  kind = "",
}) {
  return {
    id: createId("entry"),
    timestamp: new Date().toISOString(),
    level,
    scope,
    source,
    message,
    details: details === undefined ? null : safeValue(details),
    tabId,
    url,
    kind,
  };
}
