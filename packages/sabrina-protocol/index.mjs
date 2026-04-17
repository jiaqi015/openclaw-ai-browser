import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";

export const SABRINA_PROTOCOL_VERSION = "1";
export const SABRINA_CONNECTOR_BRIDGE_VERSION = "1";
export const SABRINA_BROWSER_CAPABILITY_SCHEMA_VERSION = "1";
export const SABRINA_MEMORY_RECORD_SCHEMA_VERSION = "2";
export const SABRINA_REMOTE_SESSION_CONTRACT_VERSION = "1";
export const SABRINA_PAIRING_SESSION_SCHEMA_VERSION = "1";
export const SABRINA_REMOTE_ENVELOPE_SCHEMA_VERSION = "1";
export const SABRINA_CONNECTOR_HOST = "127.0.0.1";
export const SABRINA_CONNECTOR_DEFAULT_PORT = 44718;
export const SABRINA_CONNECTOR_DIRNAME = ".sabrina";
export const SABRINA_CONNECTOR_MANIFEST_FILENAME = "connector.json";
export const SABRINA_CONNECTOR_DEVICE_FILENAME = "device.json";
export const SABRINA_CONNECTOR_PAIRINGS_FILENAME = "relay-pairings.json";

export const SABRINA_LOCAL_CAPABILITIES = Object.freeze([
  "context.read",
  "tab.control",
  "action.run",
  "memory.write",
  "memory.search",
]);

export const SABRINA_CONNECTOR_FEATURES = Object.freeze([
  `browser-capability-schema-v${SABRINA_BROWSER_CAPABILITY_SCHEMA_VERSION}`,
  `browser-memory-schema-v${SABRINA_MEMORY_RECORD_SCHEMA_VERSION}`,
  `remote-session-contract-v${SABRINA_REMOTE_SESSION_CONTRACT_VERSION}`,
  "turn-journal-v1",
]);

export const SABRINA_BROWSER_CAPABILITY_INPUT_MODES = Object.freeze([
  "page-snapshot",
  "source-url",
]);

export const SABRINA_BROWSER_CAPABILITY_SOURCE_KINDS = Object.freeze([
  "public-url",
  "private-url",
  "local-file",
]);

export const SABRINA_REMOTE_DRIVERS = Object.freeze([
  "endpoint",
  "ssh-cli",
  "relay-paired",
]);

export const SABRINA_REMOTE_ENVELOPE_PARTIES = Object.freeze([
  "browser",
  "openclaw",
  "relay",
]);

export function normalizeSabrinaTransport(value) {
  return `${value ?? "local"}`.trim() === "remote" ? "remote" : "local";
}

export function normalizeSabrinaCapabilitySource(value) {
  const normalized = `${value ?? ""}`.trim();
  if (
    normalized === "skill-metadata" ||
    normalized === "sabrina-overlay" ||
    normalized === "heuristic"
  ) {
    return normalized;
  }

  return "skill-metadata";
}

export function normalizeSabrinaBrowserCapabilityInputMode(value) {
  return SABRINA_BROWSER_CAPABILITY_INPUT_MODES.includes(`${value ?? ""}`.trim())
    ? `${value}`.trim()
    : "";
}

export function normalizeSabrinaBrowserCapabilitySourceKinds(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((entry) => `${entry ?? ""}`.trim())
        .filter((entry) => SABRINA_BROWSER_CAPABILITY_SOURCE_KINDS.includes(entry)),
    ),
  );
}

export function normalizeOpenClawProfile(value) {
  const normalized = `${value ?? ""}`.trim();
  return normalized || null;
}

export function normalizeOpenClawStateDir(value) {
  const normalized = `${value ?? ""}`.trim();
  return normalized || null;
}

export function normalizeSabrinaRemoteDriver(value) {
  const normalized = `${value ?? ""}`.trim();
  return SABRINA_REMOTE_DRIVERS.includes(normalized) ? normalized : null;
}

export function normalizeSabrinaRelayUrl(value) {
  const normalized = `${value ?? ""}`.trim();
  return normalized || null;
}

export function normalizeSabrinaConnectCode(value) {
  const normalized = `${value ?? ""}`.trim().toUpperCase();
  return normalized || null;
}

export function normalizeSabrinaRemoteEnvelopeParty(value) {
  const normalized = `${value ?? ""}`.trim();
  return SABRINA_REMOTE_ENVELOPE_PARTIES.includes(normalized) ? normalized : null;
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

export function resolveSabrinaConnectorDevicePath(homeDir = os.homedir()) {
  return path.join(
    resolveSabrinaConnectorRootDir(homeDir),
    SABRINA_CONNECTOR_DEVICE_FILENAME,
  );
}

export function resolveSabrinaConnectorPairingsPath(homeDir = os.homedir()) {
  return path.join(
    resolveSabrinaConnectorRootDir(homeDir),
    SABRINA_CONNECTOR_PAIRINGS_FILENAME,
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
    browserCapabilitySchemaVersion: SABRINA_BROWSER_CAPABILITY_SCHEMA_VERSION,
    memoryRecordSchemaVersion: SABRINA_MEMORY_RECORD_SCHEMA_VERSION,
    remoteSessionContractVersion: SABRINA_REMOTE_SESSION_CONTRACT_VERSION,
    features: [...SABRINA_CONNECTOR_FEATURES],
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
    code: normalizeSabrinaConnectCode(input.code) ?? "",
    deviceId: `${input.deviceId ?? ""}`.trim(),
    transport: normalizeSabrinaTransport(input.transport),
    driver: normalizeSabrinaRemoteDriver(input.driver),
    relayUrl: normalizeSabrinaRelayUrl(input.relayUrl),
    pairingId: `${input.pairingId ?? ""}`.trim() || null,
    expiresAt:
      typeof input.expiresAt === "string" && input.expiresAt.trim()
        ? input.expiresAt.trim()
        : new Date(Date.now() + 2 * 60_000).toISOString(),
  };
}

export function createSabrinaPairingSession(input = {}) {
  return {
    schemaVersion: SABRINA_PAIRING_SESSION_SCHEMA_VERSION,
    pairingId: `${input.pairingId ?? ""}`.trim(),
    transport: normalizeSabrinaTransport(input.transport),
    driver: normalizeSabrinaRemoteDriver(input.driver),
    relayUrl: normalizeSabrinaRelayUrl(input.relayUrl),
    connectCode: normalizeSabrinaConnectCode(input.connectCode),
    status:
      input.status === "active" ||
      input.status === "expired" ||
      input.status === "rejected"
        ? input.status
        : "pending",
    browserDeviceId: `${input.browserDeviceId ?? ""}`.trim() || null,
    openclawDeviceId: `${input.openclawDeviceId ?? ""}`.trim() || null,
    openclawLabel: `${input.openclawLabel ?? ""}`.trim() || null,
    requestedAt:
      typeof input.requestedAt === "string" && input.requestedAt.trim()
        ? input.requestedAt.trim()
        : new Date().toISOString(),
    expiresAt:
      typeof input.expiresAt === "string" && input.expiresAt.trim()
        ? input.expiresAt.trim()
        : new Date(Date.now() + 2 * 60_000).toISOString(),
    claimedAt:
      typeof input.claimedAt === "string" && input.claimedAt.trim()
        ? input.claimedAt.trim()
        : null,
    sessionId: `${input.sessionId ?? ""}`.trim() || null,
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

export function createSabrinaRemoteSessionContract(input = {}) {
  return {
    contractVersion: SABRINA_REMOTE_SESSION_CONTRACT_VERSION,
    transport: normalizeSabrinaTransport(input.transport),
    driver: normalizeSabrinaRemoteDriver(input.driver),
    profile: normalizeOpenClawProfile(input.openclawProfile ?? input.profile),
    stateDir: normalizeOpenClawStateDir(input.openclawStateDir ?? input.stateDir),
    sshTarget: `${input.sshTarget ?? ""}`.trim() || null,
    sshPort: Number.isFinite(Number(input.sshPort)) ? Number(input.sshPort) : null,
    endpointUrl: `${input.endpointUrl ?? ""}`.trim() || null,
    relayUrl: normalizeSabrinaRelayUrl(input.relayUrl),
    agentId: `${input.agentId ?? ""}`.trim() || null,
    features: Array.isArray(input.features)
      ? input.features.map((entry) => `${entry ?? ""}`.trim()).filter(Boolean)
      : [],
  };
}

export function createSabrinaRemoteEnvelope(input = {}) {
  const payload =
    input.payload && typeof input.payload === "object" ? { ...input.payload } : null;

  return {
    schemaVersion: SABRINA_REMOTE_ENVELOPE_SCHEMA_VERSION,
    sessionId: `${input.sessionId ?? ""}`.trim(),
    seq: Number.isFinite(Number(input.seq)) ? Number(input.seq) : 0,
    type: `${input.type ?? "message"}`.trim() || "message",
    from: normalizeSabrinaRemoteEnvelopeParty(input.from) ?? "browser",
    to: normalizeSabrinaRemoteEnvelopeParty(input.to) ?? "openclaw",
    ciphertext: `${input.ciphertext ?? ""}`.trim(),
    nonce: `${input.nonce ?? ""}`.trim(),
    payload,
    sentAt:
      typeof input.sentAt === "string" && input.sentAt.trim()
        ? input.sentAt.trim()
        : new Date().toISOString(),
  };
}

export function createSabrinaMemoryRecord(input = {}) {
  const metadata =
    input.metadata && typeof input.metadata === "object" ? { ...input.metadata } : {};

  return {
    schemaVersion: SABRINA_MEMORY_RECORD_SCHEMA_VERSION,
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
    metadata: {
      ...metadata,
      threadId: `${input.threadId ?? metadata.threadId ?? ""}`.trim() || undefined,
      turnId: `${input.turnId ?? metadata.turnId ?? ""}`.trim() || undefined,
      sourceKind: `${input.sourceKind ?? metadata.sourceKind ?? ""}`.trim() || undefined,
      trustLevel: `${input.trustLevel ?? metadata.trustLevel ?? ""}`.trim() || undefined,
      provenance:
        metadata.provenance && typeof metadata.provenance === "object"
          ? { ...metadata.provenance }
          : input.provenance && typeof input.provenance === "object"
            ? { ...input.provenance }
            : undefined,
    },
  };
}
