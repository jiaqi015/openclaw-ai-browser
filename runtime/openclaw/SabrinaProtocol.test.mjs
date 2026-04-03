import test from "node:test";
import assert from "node:assert/strict";
import {
  SABRINA_CONNECTOR_BRIDGE_VERSION,
  SABRINA_PROTOCOL_VERSION,
  createSabrinaConnectorManifest,
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
  assert.equal(manifest.endpoint, "http://127.0.0.1:44718");
  assert.equal(manifest.token, "secret-token");
  assert.equal(manifest.pid, 1234);
});

test("stripSabrinaConnectorSecret removes bearer secret before display", () => {
  const sanitized = stripSabrinaConnectorSecret({
    app: "sabrina",
    endpoint: "http://127.0.0.1:44718",
    token: "secret-token",
  });

  assert.deepEqual(sanitized, {
    app: "sabrina",
    endpoint: "http://127.0.0.1:44718",
  });
});
