const NETWORK_TYPES = new Set(["mainFrame", "subFrame", "xhr", "webSocket"]);
const ALL_URLS_FILTER = { urls: ["<all_urls>"] };

function createRequestTiming(details) {
  return {
    id: details.id,
    url: details.url,
    method: details.method,
    resourceType: details.resourceType,
    webContentsId: details.webContentsId ?? null,
    startedAtMs: Date.now(),
  };
}

function buildNetworkEvent(base, resolveTabIdByWebContentsId, overrides = {}) {
  const tabId = resolveTabIdByWebContentsId(base.webContentsId ?? -1);

  return {
    id: `${base.id}`,
    timestamp: new Date().toISOString(),
    tabId,
    webContentsId: base.webContentsId ?? null,
    url: base.url,
    method: base.method,
    resourceType: base.resourceType,
    phase: overrides.phase || "completed",
    statusCode: overrides.statusCode ?? null,
    statusLine: overrides.statusLine ?? "",
    durationMs: overrides.durationMs ?? null,
    fromCache: Boolean(overrides.fromCache),
    error: overrides.error ?? "",
    redirectURL: overrides.redirectURL ?? "",
  };
}

function shouldKeepNetworkEvent(details, phase) {
  return (
    NETWORK_TYPES.has(details.resourceType) ||
    phase !== "completed" ||
    Number(details.statusCode) >= 400
  );
}

function shouldLogNetworkEvent(event) {
  if (event.phase === "failed") {
    return true;
  }

  if (event.statusCode && event.statusCode >= 400) {
    return true;
  }

  return event.resourceType === "mainFrame";
}

export function bindSessionMonitoring(
  targetSession,
  {
    resolveTabIdByWebContentsId = () => null,
    pushNetworkEvent = () => {},
    recordMonitorEvent = () => {},
  } = {},
) {
  const requestTimings = new Map();

  targetSession.webRequest.onBeforeRequest(ALL_URLS_FILTER, (details, callback) => {
    requestTimings.set(details.id, createRequestTiming(details));
    callback({});
  });

  targetSession.webRequest.onBeforeRedirect(ALL_URLS_FILTER, (details) => {
    const existing = requestTimings.get(details.id) ?? createRequestTiming(details);
    const event = buildNetworkEvent(existing, resolveTabIdByWebContentsId, {
      phase: "redirected",
      statusCode: details.statusCode,
      statusLine: details.statusLine,
      fromCache: details.fromCache,
      redirectURL: details.redirectURL,
      durationMs: Math.max(0, Date.now() - existing.startedAtMs),
    });

    if (shouldKeepNetworkEvent(details, "redirected")) {
      pushNetworkEvent(event);
    }
  });

  targetSession.webRequest.onCompleted(ALL_URLS_FILTER, (details) => {
    const existing = requestTimings.get(details.id) ?? createRequestTiming(details);
    requestTimings.delete(details.id);

    const event = buildNetworkEvent(existing, resolveTabIdByWebContentsId, {
      phase: "completed",
      statusCode: details.statusCode,
      statusLine: details.statusLine,
      fromCache: details.fromCache,
      durationMs: Math.max(0, Date.now() - existing.startedAtMs),
    });

    if (shouldKeepNetworkEvent(details, "completed")) {
      pushNetworkEvent(event);
    }

    if (!shouldLogNetworkEvent(event)) {
      return;
    }

    recordMonitorEvent(
      event.statusCode >= 400 ? "warn" : "info",
      "network",
      `网络请求完成 ${event.method} ${event.statusCode ?? ""}`.trim(),
      {
        source: "network",
        tabId: event.tabId,
        url: event.url,
        kind: event.statusCode >= 400 ? "network-failure" : "network-main-frame",
        details: event,
      },
    );
  });

  targetSession.webRequest.onErrorOccurred(ALL_URLS_FILTER, (details) => {
    const existing = requestTimings.get(details.id) ?? createRequestTiming(details);
    requestTimings.delete(details.id);

    const event = buildNetworkEvent(existing, resolveTabIdByWebContentsId, {
      phase: "failed",
      error: details.error,
      fromCache: details.fromCache,
      durationMs: Math.max(0, Date.now() - existing.startedAtMs),
    });

    if (shouldKeepNetworkEvent(details, "failed")) {
      pushNetworkEvent(event);
    }

    recordMonitorEvent("error", "network", `网络请求失败: ${details.error}`, {
      source: "network",
      tabId: event.tabId,
      url: event.url,
      kind: "network-failure",
      details: event,
    });
  });
}
