import http from "node:http";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import {
  createSabrinaConnectorManifest,
  resolveSabrinaConnectorManifestPath,
  SABRINA_CONNECTOR_DEFAULT_PORT,
  stripSabrinaConnectorSecret,
} from "../../packages/sabrina-protocol/index.mjs";
import {
  connectOpenClaw,
  disconnectOpenClaw,
  doctorOpenClaw,
  getSerializedOpenClawState,
} from "../../runtime/openclaw/OpenClawRuntimeService.mjs";

let connectorServer = null;
let connectorManifest = null;
let connectorManifestPath = null;
let connectorRecordEvent = null;

function recordConnectorEvent(level, message, details = {}) {
  connectorRecordEvent?.(level, "openclaw", message, {
    source: "sabrina-connector-bridge",
    details,
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
}

function getRequestToken(req) {
  const raw = `${req.headers.authorization ?? ""}`.trim();
  if (!raw.toLowerCase().startsWith("bearer ")) {
    return "";
  }
  return raw.slice("bearer ".length).trim();
}

function isAuthorizedRequest(req) {
  return Boolean(
    connectorManifest?.token &&
      getRequestToken(req) &&
      getRequestToken(req) === connectorManifest.token,
  );
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
}

async function writeConnectorManifest(manifest) {
  const manifestPath = resolveSabrinaConnectorManifestPath();
  await mkdir(path.dirname(manifestPath), { recursive: true, mode: 0o700 });
  await writeFile(`${manifestPath}`, `${JSON.stringify(manifest, null, 2)}\n`, {
    mode: 0o600,
  });
  connectorManifestPath = manifestPath;
}

async function removeConnectorManifest() {
  if (!connectorManifestPath) {
    return;
  }

  try {
    const currentRaw = await readFile(connectorManifestPath, "utf8");
    const current = JSON.parse(currentRaw);
    if (current?.token === connectorManifest?.token) {
      await rm(connectorManifestPath, { force: true });
    }
  } catch {
    // Best effort cleanup only.
  }
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Sabrina connector bridge did not expose a TCP address."));
        return;
      }
      resolve(address);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "127.0.0.1");
  });
}

async function listenWithFallback(server) {
  try {
    return await listen(server, SABRINA_CONNECTOR_DEFAULT_PORT);
  } catch (error) {
    if (error?.code !== "EADDRINUSE") {
      throw error;
    }
    return listen(server, 0);
  }
}

async function handleConnectorRequest(req, res) {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");

  if (req.method === "GET" && url.pathname === "/v1/connector/health") {
    sendJson(res, 200, {
      ok: true,
      connector: {
        ...stripSabrinaConnectorSecret(connectorManifest),
        version: app.getVersion(),
      },
      connectionState: getSerializedOpenClawState().connectionState,
    });
    return;
  }

  if (!isAuthorizedRequest(req)) {
    sendJson(res, 401, {
      ok: false,
      error: "Unauthorized connector request.",
    });
    return;
  }

  try {
    if (req.method === "GET" && url.pathname === "/v1/openclaw/status") {
      const state = getSerializedOpenClawState();
      sendJson(res, 200, {
        ok: true,
        state,
        connectionState: state.connectionState,
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/v1/openclaw/doctor") {
      const report = await doctorOpenClaw({
        target: url.searchParams.get("target") || undefined,
        driver: url.searchParams.get("driver") || undefined,
        profile: url.searchParams.get("profile") || undefined,
        stateDir: url.searchParams.get("stateDir") || undefined,
        sshTarget: url.searchParams.get("sshTarget") || undefined,
        sshPort: url.searchParams.get("sshPort")
          ? Number(url.searchParams.get("sshPort"))
          : undefined,
        relayUrl: url.searchParams.get("relayUrl") || undefined,
        connectCode: url.searchParams.get("connectCode") || undefined,
        label: url.searchParams.get("label") || undefined,
        agentId: url.searchParams.get("agentId") || undefined,
      });
      sendJson(res, 200, { ok: true, report });
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/openclaw/connect") {
      const payload = await readJsonBody(req);
      const state = await connectOpenClaw(payload ?? {});
      sendJson(res, 200, {
        ok: true,
        state,
        connectionState: state?.connectionState ?? null,
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/openclaw/disconnect") {
      const payload = await readJsonBody(req);
      const state = await disconnectOpenClaw(payload ?? {});
      sendJson(res, 200, {
        ok: true,
        state,
        connectionState: state?.connectionState ?? null,
      });
      return;
    }

    sendJson(res, 404, {
      ok: false,
      error: `Unknown Sabrina connector route: ${req.method} ${url.pathname}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    recordConnectorEvent("error", "Sabrina connector request failed", {
      method: req.method,
      path: url.pathname,
      error: message,
    });
    sendJson(res, 500, {
      ok: false,
      error: message,
    });
  }
}

export async function startSabrinaConnectorBridge(options = {}) {
  if (connectorServer && connectorManifest) {
    return stripSabrinaConnectorSecret(connectorManifest);
  }

  connectorRecordEvent = typeof options.recordEvent === "function" ? options.recordEvent : null;
  const server = http.createServer((req, res) => {
    void handleConnectorRequest(req, res);
  });
  const address = await listenWithFallback(server);
  connectorManifest = createSabrinaConnectorManifest({
    host: address.address,
    port: address.port,
  });
  connectorServer = server;
  await writeConnectorManifest(connectorManifest);
  recordConnectorEvent("info", "Sabrina connector bridge ready", {
    endpoint: connectorManifest.endpoint,
  });
  return stripSabrinaConnectorSecret(connectorManifest);
}

export async function stopSabrinaConnectorBridge() {
  const server = connectorServer;
  connectorServer = null;

  if (!server) {
    return;
  }

  await new Promise((resolve) => {
    server.close(() => resolve());
  });
  await removeConnectorManifest();
  recordConnectorEvent("info", "Sabrina connector bridge stopped");
  connectorManifest = null;
  connectorManifestPath = null;
}
