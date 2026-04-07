import { readFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { loadSabrinaProtocol } from "./protocol-loader.mjs";

const execFileAsync = promisify(execFile);
const DEFAULT_CONNECTOR_FETCH_TIMEOUT_MS = 8_000;
const DEFAULT_RECOVERY_TIMEOUT_MS = 10_000;

async function resolveConfiguredManifestPath(pluginConfig = {}) {
  const configuredPath = `${pluginConfig?.manifestPath ?? ""}`.trim();
  if (configuredPath) {
    return configuredPath;
  }

  const envPath = `${process.env.SABRINA_CONNECTOR_MANIFEST ?? ""}`.trim();
  if (envPath) {
    return envPath;
  }

  const { resolveSabrinaConnectorManifestPath } = await loadSabrinaProtocol();
  return resolveSabrinaConnectorManifestPath();
}

function formatBridgeError(message, manifestPath) {
  return `Sabrina connector unavailable: ${message} (${manifestPath})`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecoverableBridgeError(error) {
  const message = `${error instanceof Error ? error.message : error ?? ""}`.toLowerCase();
  return (
    message.includes("fetch failed") ||
    message.includes("ecconnrefused") ||
    message.includes("econnreset") ||
    message.includes("timed out") ||
    message.includes("networkerror")
  );
}

function isProcessRunning(pid) {
  const numericPid = Number(pid);
  if (!Number.isInteger(numericPid) || numericPid <= 0) {
    return false;
  }
  try {
    process.kill(numericPid, 0);
    return true;
  } catch {
    return false;
  }
}

async function launchSabrinaApp() {
  if (process.platform !== "darwin") {
    return false;
  }

  try {
    await execFileAsync("open", ["-a", process.env.SABRINA_APP_NAME || "Sabrina"], {
      timeout: 4_000,
    });
    return true;
  } catch {
    return false;
  }
}

async function fetchConnectorResponse(url, options = {}) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(
    () => controller.abort(new Error("Connector request timed out.")),
    options.timeout ?? DEFAULT_CONNECTOR_FETCH_TIMEOUT_MS,
  );

  try {
    return await fetch(url, {
      method: options.method ?? "GET",
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function performConnectorRequest(manifestPath, manifest, pathname, options = {}) {
  const response = await fetchConnectorResponse(`${manifest.endpoint}${pathname}`, {
    method: options.method ?? "GET",
    headers: {
      authorization: `Bearer ${manifest.token}`,
      ...(options.body ? { "content-type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    timeout: options.timeout,
  });

  const text = await response.text();
  let payload = null;
  if (text.trim()) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }

  if (!response.ok) {
    const detail =
      typeof payload?.error === "string" && payload.error.trim()
        ? payload.error.trim()
        : `${response.status} ${response.statusText}`.trim();
    throw new Error(formatBridgeError(detail, manifestPath));
  }

  return {
    manifestPath,
    manifest,
    payload,
  };
}

async function performConnectorHealthRequest(manifestPath, manifest, options = {}) {
  const { stripSabrinaConnectorSecret } = await loadSabrinaProtocol();
  const response = await fetchConnectorResponse(`${manifest.endpoint}/v1/connector/health`, {
    timeout: options.timeout,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      typeof payload?.error === "string" && payload.error.trim()
        ? payload.error.trim()
        : `${response.status} ${response.statusText}`.trim();
    throw new Error(formatBridgeError(detail, manifestPath));
  }
  return {
    manifestPath,
    manifest,
    connector: payload?.connector ?? stripSabrinaConnectorSecret(manifest),
    payload,
  };
}

async function recoverSabrinaConnector(pluginConfig, manifestPath, manifest) {
  const pidRunning = isProcessRunning(manifest?.pid);
  if (!pidRunning) {
    await rm(manifestPath, { force: true }).catch(() => {});
  }

  await launchSabrinaApp().catch(() => false);
  const deadline = Date.now() + DEFAULT_RECOVERY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const nextManifestResult = await loadSabrinaConnectorManifest(pluginConfig);
      await performConnectorHealthRequest(
        nextManifestResult.manifestPath,
        nextManifestResult.manifest,
        { timeout: 1_500 },
      );
      return nextManifestResult;
    } catch {
      await sleep(500);
    }
  }

  throw new Error(formatBridgeError("Sabrina 没有及时恢复连接桥", manifestPath));
}

export async function loadSabrinaConnectorManifest(pluginConfig = {}) {
  const manifestPath = await resolveConfiguredManifestPath(pluginConfig);
  let raw;
  try {
    raw = await readFile(manifestPath, "utf8");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(formatBridgeError(detail, manifestPath));
  }

  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(formatBridgeError(`invalid JSON: ${detail}`, manifestPath));
  }

  if (!manifest?.endpoint || !manifest?.token) {
    throw new Error(formatBridgeError("manifest is missing endpoint or token", manifestPath));
  }

  return {
    manifestPath,
    manifest,
  };
}

export async function requestSabrinaConnector(pluginConfig, pathname, options = {}) {
  const { manifestPath, manifest } = await loadSabrinaConnectorManifest(pluginConfig);
  const { stripSabrinaConnectorSecret } = await loadSabrinaProtocol();

  try {
    const response = await performConnectorRequest(manifestPath, manifest, pathname, options);
    return {
      ...response,
      connector: stripSabrinaConnectorSecret(manifest),
    };
  } catch (error) {
    if (!isRecoverableBridgeError(error)) {
      throw error;
    }

    const recovered = await recoverSabrinaConnector(pluginConfig, manifestPath, manifest);
    const response = await performConnectorRequest(
      recovered.manifestPath,
      recovered.manifest,
      pathname,
      options,
    );
    return {
      ...response,
      connector: stripSabrinaConnectorSecret(recovered.manifest),
    };
  }
}

export async function getSabrinaConnectorHealth(pluginConfig = {}) {
  const { manifestPath, manifest } = await loadSabrinaConnectorManifest(pluginConfig);

  try {
    return await performConnectorHealthRequest(manifestPath, manifest);
  } catch (error) {
    if (!isRecoverableBridgeError(error)) {
      throw error;
    }

    const recovered = await recoverSabrinaConnector(pluginConfig, manifestPath, manifest);
    return performConnectorHealthRequest(recovered.manifestPath, recovered.manifest);
  }
}

export function formatConnectionSummary(
  connectionState,
  connector = null,
  runtimeInsights = null,
) {
  if (!connectionState) {
    return "Sabrina is running, but OpenClaw connection state is unavailable.";
  }

  const lines = [
    `Status: ${connectionState.summary ?? connectionState.status ?? "unknown"}`,
  ];

  if (connector?.endpoint) {
    lines.push(`Connector: ${connector.endpoint}`);
  }
  if (connectionState.detail) {
    lines.push(`Detail: ${connectionState.detail}`);
  }
  if (connectionState.transportLabel) {
    lines.push(`Target: ${connectionState.transportLabel}`);
  }
  if (connector?.browserCapabilitySchemaVersion || connector?.remoteSessionContractVersion) {
    lines.push(
      `Schema: capability v${connector?.browserCapabilitySchemaVersion ?? "n/a"} · remote v${connector?.remoteSessionContractVersion ?? "n/a"}`,
    );
  }
  if (Array.isArray(connector?.features) && connector.features.length > 0) {
    lines.push(`Features: ${connector.features.join(", ")}`);
  }
  if (connectionState.remoteSessionContract?.driver) {
    lines.push(
      `Remote contract: v${connectionState.remoteSessionContract.contractVersion} · ${connectionState.remoteSessionContract.driver}`,
    );
  }
  if (runtimeInsights?.skillCatalog) {
    lines.push(
      `Skills: ${runtimeInsights.skillCatalog.ready}/${runtimeInsights.skillCatalog.total} ready · declared ${runtimeInsights.skillCatalog.capabilitySourceCounts?.declared ?? 0} · overlay ${runtimeInsights.skillCatalog.capabilitySourceCounts?.overlay ?? 0} · heuristic ${runtimeInsights.skillCatalog.capabilitySourceCounts?.heuristic ?? 0}`,
    );
  }
  if (runtimeInsights?.turnJournal) {
    lines.push(
      `Turn journal: ${runtimeInsights.turnJournal.count} entries · latest ${runtimeInsights.turnJournal.latestStatus ?? "n/a"}`,
    );
  }
  if (runtimeInsights?.browserMemory) {
    lines.push(
      `Browser memory: ${runtimeInsights.browserMemory.count} records · latest ${runtimeInsights.browserMemory.latestCapturedAt ?? "n/a"}`,
    );
  }
  if (connectionState.commandHint) {
    lines.push(`Hint: ${connectionState.commandHint}`);
  }

  return lines.join("\n");
}

export function formatDoctorReport(report) {
  if (!report) {
    return "No Sabrina doctor report returned.";
  }

  const lines = [];
  lines.push(
    `Doctor: ${report.transportLabel ?? report.transport ?? "unknown"} · ${report.failureCount ?? 0} fail · ${report.warningCount ?? 0} warn · ${report.checkCount ?? 0} check(s)`,
  );
  if (Array.isArray(report.checks)) {
    for (const check of report.checks) {
      const badge =
        check.status === "pass" ? "OK" : check.status === "warn" ? "WARN" : "FAIL";
      lines.push(`${badge} ${check.label}: ${check.detail}`);
    }
  }
  return lines.join("\n");
}

export function formatConnectionProbe(probe) {
  if (!probe) {
    return "No Sabrina quick check result returned.";
  }

  const lines = [];
  lines.push(
    `Quick check: ${probe.summary ?? (probe.ok ? "ready" : "attention")} · ${probe.failureCount ?? 0} fail · ${probe.warningCount ?? 0} warn · ${probe.checkCount ?? 0} check(s)`,
  );
  if (probe.detail) {
    lines.push(`Detail: ${probe.detail}`);
  }
  if (Array.isArray(probe.checks)) {
    for (const check of probe.checks) {
      const badge =
        check.status === "pass" ? "OK" : check.status === "warn" ? "WARN" : "FAIL";
      lines.push(`${badge} ${check.label}: ${check.detail}`);
    }
  }
  return lines.join("\n");
}
