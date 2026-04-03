import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";

export const SABRINA_PROTOCOL_VERSION = "1";
export const SABRINA_CONNECTOR_BRIDGE_VERSION = "1";
export const SABRINA_CONNECTOR_HOST = "127.0.0.1";
export const SABRINA_CONNECTOR_DEFAULT_PORT = 44718;
export const SABRINA_CONNECTOR_DIRNAME = ".sabrina";
export const SABRINA_CONNECTOR_MANIFEST_FILENAME = "connector.json";

export const SABRINA_LOCAL_CAPABILITIES = Object.freeze([
  "context.read",
  "tab.control",
  "action.run",
  "memory.write",
  "memory.search",
]);

export function normalizeSabrinaTransport(value) {
  return `${value ?? "local"}`.trim() === "remote" ? "remote" : "local";
}

export function normalizeOpenClawProfile(value) {
  const normalized = `${value ?? ""}`.trim();
  return normalized || null;
}

export function normalizeOpenClawStateDir(value) {
  const normalized = `${value ?? ""}`.trim();
  return normalized || null;
}

export function resolveSabrinaConnectorRootDir(homeDir = os.homedir()) {
  return path.join(homeDir, SABRINA_CONNECTOR_DIRNAME);
}

export function resolveSabrinaConnectorManifestPath(homeDir = os.homedir()) {
  return path.join(
    resolveSabrinaConnectorRootDir(homeDir),
    SABRINA_CONNECTOR_MANIFEST_FILENAME,
  );
}

export function createSabrinaConnectorSecret() {
  return crypto.randomUUID().replace(/-/g, "");
}

export function buildSabrinaConnectorEndpoint(input = {}) {
  const host = `${input.host ?? SABRINA_CONNECTOR_HOST}`.trim() || SABRINA_CONNECTOR_HOST;
  const port = Number(input.port ?? SABRINA_CONNECTOR_DEFAULT_PORT) || SABRINA_CONNECTOR_DEFAULT_PORT;
  return `http://${host}:${port}`;
}

export function createSabrinaConnectorManifest(input = {}) {
  return {
    app: "sabrina",
    bridgeVersion: SABRINA_CONNECTOR_BRIDGE_VERSION,
    protocolVersion: SABRINA_PROTOCOL_VERSION,
    transport: normalizeSabrinaTransport(input.transport),
    endpoint: buildSabrinaConnectorEndpoint({
      host: input.host,
      port: input.port,
    }),
    token: `${input.token ?? createSabrinaConnectorSecret()}`.trim(),
    pid: Number(input.pid ?? process.pid) || process.pid,
    updatedAt:
      typeof input.updatedAt === "string" && input.updatedAt.trim()
        ? input.updatedAt.trim()
        : new Date().toISOString(),
  };
}

export function stripSabrinaConnectorSecret(manifest) {
  if (!manifest || typeof manifest !== "object") {
    return null;
  }

  const { token: _token, ...rest } = manifest;
  return rest;
}

export function createSabrinaConnectCode(input = {}) {
  return {
    code: `${input.code ?? ""}`.trim(),
    deviceId: `${input.deviceId ?? ""}`.trim(),
    transport: normalizeSabrinaTransport(input.transport),
    expiresAt:
      typeof input.expiresAt === "string" && input.expiresAt.trim()
        ? input.expiresAt.trim()
        : new Date(Date.now() + 2 * 60_000).toISOString(),
  };
}

export function createSabrinaBinding(input = {}) {
  return {
    bindingId: `${input.bindingId ?? ""}`.trim(),
    protocolVersion: SABRINA_PROTOCOL_VERSION,
    transport: normalizeSabrinaTransport(input.transport),
    openclawProfile: normalizeOpenClawProfile(input.openclawProfile),
    openclawStateDir: normalizeOpenClawStateDir(input.openclawStateDir),
    agentId: `${input.agentId ?? ""}`.trim(),
    browserDeviceId: `${input.browserDeviceId ?? ""}`.trim(),
    displayName: `${input.displayName ?? ""}`.trim(),
    capabilities: Array.isArray(input.capabilities)
      ? input.capabilities
          .map((entry) => `${entry ?? ""}`.trim())
          .filter(Boolean)
      : [...SABRINA_LOCAL_CAPABILITIES],
    status:
      input.status === "revoked" || input.status === "disconnected" ? input.status : "active",
    createdAt:
      typeof input.createdAt === "string" && input.createdAt.trim()
        ? input.createdAt.trim()
        : new Date().toISOString(),
    lastSeenAt:
      typeof input.lastSeenAt === "string" && input.lastSeenAt.trim()
        ? input.lastSeenAt.trim()
        : null,
  };
}

export function createSabrinaMemoryRecord(input = {}) {
  return {
    id: `${input.id ?? ""}`.trim(),
    kind: `${input.kind ?? "page-summary"}`.trim() || "page-summary",
    url: `${input.url ?? ""}`.trim(),
    host: `${input.host ?? ""}`.trim(),
    title: `${input.title ?? ""}`.trim(),
    summary: `${input.summary ?? ""}`.trim(),
    entities: Array.isArray(input.entities)
      ? input.entities.map((entry) => `${entry ?? ""}`.trim()).filter(Boolean)
      : [],
    keywords: Array.isArray(input.keywords)
      ? input.keywords.map((entry) => `${entry ?? ""}`.trim()).filter(Boolean)
      : [],
    source: "browser",
    capturedAt:
      typeof input.capturedAt === "string" && input.capturedAt.trim()
        ? input.capturedAt.trim()
        : new Date().toISOString(),
    updatedAt:
      typeof input.updatedAt === "string" && input.updatedAt.trim()
        ? input.updatedAt.trim()
        : new Date().toISOString(),
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
  };
}
