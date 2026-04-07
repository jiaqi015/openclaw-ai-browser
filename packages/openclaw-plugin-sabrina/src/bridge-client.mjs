import { readFile } from "node:fs/promises";
import { loadSabrinaProtocol } from "./protocol-loader.mjs";

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
  const response = await fetch(`${manifest.endpoint}${pathname}`, {
    method: options.method ?? "GET",
    headers: {
      authorization: `Bearer ${manifest.token}`,
      ...(options.body ? { "content-type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
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
    connector: stripSabrinaConnectorSecret(manifest),
    payload,
  };
}

export async function getSabrinaConnectorHealth(pluginConfig = {}) {
  const { manifestPath, manifest } = await loadSabrinaConnectorManifest(pluginConfig);
  const { stripSabrinaConnectorSecret } = await loadSabrinaProtocol();
  const response = await fetch(`${manifest.endpoint}/v1/connector/health`);
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
