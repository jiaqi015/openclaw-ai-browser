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

export function formatConnectionSummary(connectionState) {
  if (!connectionState) {
    return "Sabrina is running, but OpenClaw connection state is unavailable.";
  }

  const lines = [
    `Status: ${connectionState.summary ?? connectionState.status ?? "unknown"}`,
  ];

  if (connectionState.detail) {
    lines.push(`Detail: ${connectionState.detail}`);
  }
  if (connectionState.transportLabel) {
    lines.push(`Target: ${connectionState.transportLabel}`);
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
  if (report.summary) {
    lines.push(report.summary);
  }
  if (Array.isArray(report.checks)) {
    for (const check of report.checks) {
      const badge = check.ok ? "OK" : "FAIL";
      lines.push(`${badge} ${check.label}: ${check.detail}`);
    }
  }
  return lines.join("\n");
}
