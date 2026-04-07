import test from "node:test";
import assert from "node:assert/strict";
import {
  SABRINA_BROWSER_CAPABILITY_SCHEMA_VERSION,
  SABRINA_CONNECTOR_BRIDGE_VERSION,
  SABRINA_CONNECTOR_FEATURES,
  SABRINA_MEMORY_RECORD_SCHEMA_VERSION,
  SABRINA_PAIRING_SESSION_SCHEMA_VERSION,
  SABRINA_PROTOCOL_VERSION,
  SABRINA_REMOTE_ENVELOPE_SCHEMA_VERSION,
  SABRINA_REMOTE_SESSION_CONTRACT_VERSION,
  createSabrinaConnectCode,
  createSabrinaMemoryRecord,
  createSabrinaConnectorManifest,
  createSabrinaPairingSession,
  createSabrinaRemoteEnvelope,
  createSabrinaRemoteSessionContract,
  resolveSabrinaConnectorManifestPath,
  stripSabrinaConnectorSecret,
} from "../../packages/sabrina-protocol/index.mjs";

test("resolveSabrinaConnectorManifestPath uses stable shared location", () => {
  assert.equal(
    resolveSabrinaConnectorManifestPath("/tmp/sabrina-home"),
    "/tmp/sabrina-home/.sabrina/connector.json",
  );
});

test("createSabrinaConnectorManifest builds loopback discovery payload", () => {
  const manifest = createSabrinaConnectorManifest({
    host: "127.0.0.1",
    port: 44718,
    token: "secret-token",
    pid: 1234,
  });

  assert.equal(manifest.app, "sabrina");
  assert.equal(manifest.protocolVersion, SABRINA_PROTOCOL_VERSION);
  assert.equal(manifest.bridgeVersion, SABRINA_CONNECTOR_BRIDGE_VERSION);
  assert.equal(
    manifest.browserCapabilitySchemaVersion,
    SABRINA_BROWSER_CAPABILITY_SCHEMA_VERSION,
  );
  assert.equal(manifest.memoryRecordSchemaVersion, SABRINA_MEMORY_RECORD_SCHEMA_VERSION);
  assert.equal(
    manifest.remoteSessionContractVersion,
    SABRINA_REMOTE_SESSION_CONTRACT_VERSION,
  );
  assert.deepEqual(manifest.features, [...SABRINA_CONNECTOR_FEATURES]);
  assert.equal(manifest.endpoint, "http://127.0.0.1:44718");
  assert.equal(manifest.token, "secret-token");
  assert.equal(manifest.pid, 1234);
});

test("stripSabrinaConnectorSecret removes bearer secret before display", () => {
  const sanitized = stripSabrinaConnectorSecret(
    createSabrinaConnectorManifest({
      host: "127.0.0.1",
      port: 44718,
      token: "secret-token",
      pid: 1234,
    }),
  );

  assert.equal(sanitized.app, "sabrina");
  assert.equal(sanitized.endpoint, "http://127.0.0.1:44718");
  assert.equal(sanitized.protocolVersion, SABRINA_PROTOCOL_VERSION);
  assert.equal(sanitized.bridgeVersion, SABRINA_CONNECTOR_BRIDGE_VERSION);
  assert.equal("token" in sanitized, false);
});

test("createSabrinaRemoteSessionContract normalizes transport contract fields", () => {
  const contract = createSabrinaRemoteSessionContract({
    transport: "remote",
    driver: "relay-paired",
    profile: "work",
    stateDir: "/tmp/openclaw",
    relayUrl: "https://relay.example.com",
    agentId: "sabrina-browser",
    features: ["context.read"],
  });

  assert.equal(contract.contractVersion, SABRINA_REMOTE_SESSION_CONTRACT_VERSION);
  assert.equal(contract.transport, "remote");
  assert.equal(contract.driver, "relay-paired");
  assert.equal(contract.profile, "work");
  assert.equal(contract.stateDir, "/tmp/openclaw");
  assert.equal(contract.relayUrl, "https://relay.example.com");
  assert.equal(contract.agentId, "sabrina-browser");
});

test("createSabrinaConnectCode normalizes relay connect codes", () => {
  const connectCode = createSabrinaConnectCode({
    code: " ab12cd ",
    transport: "remote",
    driver: "relay-paired",
    relayUrl: "https://relay.example.com",
    pairingId: "pair-1",
  });

  assert.equal(connectCode.code, "AB12CD");
  assert.equal(connectCode.driver, "relay-paired");
  assert.equal(connectCode.relayUrl, "https://relay.example.com");
  assert.equal(connectCode.pairingId, "pair-1");
});

test("createSabrinaPairingSession and remote envelope create stable protocol records", () => {
  const pairing = createSabrinaPairingSession({
    pairingId: "pair-1",
    transport: "remote",
    driver: "relay-paired",
    relayUrl: "https://relay.example.com",
    connectCode: "482913",
  });
  const envelope = createSabrinaRemoteEnvelope({
    sessionId: "session-1",
    seq: 3,
    type: "message",
    from: "browser",
    to: "openclaw",
    ciphertext: "abc",
    nonce: "nonce-1",
    payload: {
      kind: "probe.ping",
    },
  });

  assert.equal(pairing.schemaVersion, SABRINA_PAIRING_SESSION_SCHEMA_VERSION);
  assert.equal(pairing.connectCode, "482913");
  assert.equal(pairing.driver, "relay-paired");
  assert.equal(envelope.schemaVersion, SABRINA_REMOTE_ENVELOPE_SCHEMA_VERSION);
  assert.equal(envelope.seq, 3);
  assert.equal(envelope.from, "browser");
  assert.equal(envelope.to, "openclaw");
  assert.equal(envelope.payload?.kind, "probe.ping");
});

test("createSabrinaMemoryRecord adds schema version and browser provenance metadata", () => {
  const record = createSabrinaMemoryRecord({
    id: "memory-1",
    url: "https://example.com",
    title: "Example",
    summary: "Summary",
    threadId: "thread-1",
    turnId: "turn-1",
    sourceKind: "public-http",
    trustLevel: "public",
  });

  assert.equal(record.schemaVersion, SABRINA_MEMORY_RECORD_SCHEMA_VERSION);
  assert.equal(record.metadata.threadId, "thread-1");
  assert.equal(record.metadata.turnId, "turn-1");
  assert.equal(record.metadata.sourceKind, "public-http");
  assert.equal(record.metadata.trustLevel, "public");
});
