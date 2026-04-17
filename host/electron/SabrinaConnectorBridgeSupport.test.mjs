import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import {
  configureConnectorServer,
  createConnectorBridgeRequestHandler,
  createTestRequest,
  writeConnectorManifestFile,
} from "./SabrinaConnectorBridgeSupport.mjs";

function createResponseRecorder() {
  let finishResolver = null;
  return {
    statusCode: 200,
    headers: {},
    bodyText: "",
    finished: false,
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = { ...headers };
    },
    end(chunk = "") {
      this.bodyText = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : `${chunk ?? ""}`;
      this.finished = true;
      finishResolver?.();
    },
    once(eventName, listener) {
      if (eventName === "finish") {
        if (this.finished) {
          listener();
        } else {
          finishResolver = listener;
        }
      }
    },
  };
}

function createHandler() {
  return createConnectorBridgeRequestHandler({
    getAppVersion: () => "0.1.13",
    getConnectorManifest: () => ({
      endpoint: "http://127.0.0.1:44718",
      token: "secret-token",
      pid: 123,
    }),
    stripConnectorManifest: (manifest) => ({ endpoint: manifest.endpoint, pid: manifest.pid }),
    runtime: {
      getSerializedOpenClawState: () => ({
        connectionState: { status: "connected", summary: "Connected" },
      }),
      getOpenClawRuntimeInsights: async () => ({ turnJournal: { count: 1 } }),
      connectOpenClaw: async (payload) => ({
        ok: true,
        connectionState: { status: "connected", detail: payload.target ?? "local" },
      }),
      disconnectOpenClaw: async () => ({
        ok: true,
        connectionState: { status: "idle" },
      }),
      doctorOpenClaw: async () => ({ checks: [] }),
      probeOpenClawConnection: async () => ({ ok: true }),
      getOpenClawSupportSnapshot: async () => ({ ok: true, items: [] }),
      getOpenClawRelayPairingState: async () => ({ status: "idle" }),
      listOpenClawRelayEnvelopes: async () => ({ items: [] }),
      createOpenClawRelayConnectCode: async () => ({ code: "ABCD" }),
      sendOpenClawRelayEnvelope: async () => ({ accepted: true }),
    },
  });
}

async function callHandler(handler, requestOptions) {
  const req = createTestRequest(requestOptions);
  const res = createResponseRecorder();
  await handler(req, res);
  await new Promise((resolve) => res.once("finish", resolve));
  return {
    statusCode: res.statusCode,
    body: JSON.parse(res.bodyText || "{}"),
  };
}

test("connector bridge health requires bearer token", async () => {
  const handler = createHandler();
  const response = await callHandler(handler, {
    method: "GET",
    url: "/v1/connector/health",
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.ok, false);
});

test("connector bridge rejects browser-originated requests", async () => {
  const handler = createHandler();
  const response = await callHandler(handler, {
    method: "GET",
    url: "/v1/connector/health",
    headers: {
      authorization: "Bearer secret-token",
      origin: "http://127.0.0.1:3000",
    },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.ok, false);
});

test("connector bridge returns sanitized health payload after auth", async () => {
  const handler = createHandler();
  const response = await callHandler(handler, {
    method: "GET",
    url: "/v1/connector/health",
    headers: {
      authorization: "Bearer secret-token",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.connector.endpoint, "http://127.0.0.1:44718");
  assert.equal("token" in response.body.connector, false);
});

test("connector bridge rejects invalid JSON bodies before runtime handlers", async () => {
  const handler = createHandler();
  const response = await callHandler(handler, {
    method: "POST",
    url: "/v1/openclaw/connect",
    headers: {
      authorization: "Bearer secret-token",
      "content-type": "application/json",
    },
    body: "{not json}",
  });

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /valid JSON/i);
});

test("configureConnectorServer applies conservative timeout defaults", () => {
  const server = configureConnectorServer(http.createServer());
  assert.equal(server.requestTimeout, 15000);
  assert.equal(server.headersTimeout, 16000);
  assert.equal(server.keepAliveTimeout, 1000);
  assert.equal(server.maxHeadersCount, 32);
  server.close();
});

test("writeConnectorManifestFile enforces 0600 file permissions", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sabrina-bridge-"));
  const manifestPath = path.join(tempDir, ".sabrina", "connector.json");

  try {
    const writtenPath = await writeConnectorManifestFile(
      {
        endpoint: "http://127.0.0.1:44718",
        token: "secret-token",
      },
      { manifestPath },
    );
    const stats = await fs.stat(writtenPath);
    assert.equal(stats.mode & 0o777, 0o600);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
