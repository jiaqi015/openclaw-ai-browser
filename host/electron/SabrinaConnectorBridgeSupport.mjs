import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveSabrinaConnectorManifestPath } from "../../packages/sabrina-protocol/index.mjs";

export const CONNECTOR_REQUEST_TIMEOUT_MS = 15_000;
export const CONNECTOR_HEADERS_TIMEOUT_MS = 16_000;
export const CONNECTOR_KEEP_ALIVE_TIMEOUT_MS = 1_000;
export const CONNECTOR_MAX_BODY_BYTES = 256 * 1024;

function normalizeNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parseOptionalNumber(value) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getRequestToken(req) {
  const raw = normalizeNonEmptyString(req?.headers?.authorization);
  if (!raw.toLowerCase().startsWith("bearer ")) {
    return "";
  }
  return raw.slice("bearer ".length).trim();
}

function getRequestOrigin(req) {
  return normalizeNonEmptyString(req?.headers?.origin);
}

function isBrowserOriginAllowed(req) {
  return getRequestOrigin(req) === "";
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
  });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req, options = {}) {
  const maxBytes = Number(options?.maxBytes) || CONNECTOR_MAX_BODY_BYTES;
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > maxBytes) {
      throw createHttpError(413, "Connector request body too large.");
    }
    chunks.push(buffer);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw createHttpError(400, "Connector request body must be valid JSON.");
  }
}

function recordRejectedRequest(recordEvent, recordSecurityEvent, req, url, reason) {
  const details = {
    method: normalizeNonEmptyString(req?.method),
    path: normalizeNonEmptyString(url?.pathname),
    origin: getRequestOrigin(req),
    reason,
  };
  recordEvent?.("warn", "Sabrina connector request rejected", details);
  recordSecurityEvent?.("connector.request_rejected", details);
}

function buildRuntimeHandlers(runtime = {}) {
  return {
    getSerializedOpenClawState:
      typeof runtime.getSerializedOpenClawState === "function"
        ? runtime.getSerializedOpenClawState
        : () => {
            throw new Error("OpenClaw state handler is unavailable.");
          },
    getOpenClawRuntimeInsights:
      typeof runtime.getOpenClawRuntimeInsights === "function"
        ? runtime.getOpenClawRuntimeInsights
        : async () => {
            throw new Error("OpenClaw runtime insights handler is unavailable.");
          },
    getOpenClawSupportSnapshot:
      typeof runtime.getOpenClawSupportSnapshot === "function"
        ? runtime.getOpenClawSupportSnapshot
        : async () => {
            throw new Error("OpenClaw support snapshot handler is unavailable.");
          },
    doctorOpenClaw:
      typeof runtime.doctorOpenClaw === "function"
        ? runtime.doctorOpenClaw
        : async () => {
            throw new Error("OpenClaw doctor handler is unavailable.");
          },
    probeOpenClawConnection:
      typeof runtime.probeOpenClawConnection === "function"
        ? runtime.probeOpenClawConnection
        : async () => {
            throw new Error("OpenClaw probe handler is unavailable.");
          },
    getOpenClawRelayPairingState:
      typeof runtime.getOpenClawRelayPairingState === "function"
        ? runtime.getOpenClawRelayPairingState
        : async () => {
            throw new Error("OpenClaw relay pairing handler is unavailable.");
          },
    listOpenClawRelayEnvelopes:
      typeof runtime.listOpenClawRelayEnvelopes === "function"
        ? runtime.listOpenClawRelayEnvelopes
        : async () => {
            throw new Error("OpenClaw relay envelope handler is unavailable.");
          },
    createOpenClawRelayConnectCode:
      typeof runtime.createOpenClawRelayConnectCode === "function"
        ? runtime.createOpenClawRelayConnectCode
        : async () => {
            throw new Error("OpenClaw relay connect-code handler is unavailable.");
          },
    sendOpenClawRelayEnvelope:
      typeof runtime.sendOpenClawRelayEnvelope === "function"
        ? runtime.sendOpenClawRelayEnvelope
        : async () => {
            throw new Error("OpenClaw relay send handler is unavailable.");
          },
    connectOpenClaw:
      typeof runtime.connectOpenClaw === "function"
        ? runtime.connectOpenClaw
        : async () => {
            throw new Error("OpenClaw connect handler is unavailable.");
          },
    disconnectOpenClaw:
      typeof runtime.disconnectOpenClaw === "function"
        ? runtime.disconnectOpenClaw
        : async () => {
            throw new Error("OpenClaw disconnect handler is unavailable.");
          },
  };
}

export function createConnectorBridgeRequestHandler(options = {}) {
  const getAppVersion =
    typeof options?.getAppVersion === "function" ? options.getAppVersion : () => "";
  const getConnectorManifest =
    typeof options?.getConnectorManifest === "function" ? options.getConnectorManifest : () => null;
  const stripConnectorManifest =
    typeof options?.stripConnectorManifest === "function"
      ? options.stripConnectorManifest
      : (manifest) => manifest;
  const recordEvent =
    typeof options?.recordEvent === "function" ? options.recordEvent : () => {};
  const recordSecurityEvent =
    typeof options?.recordSecurityEvent === "function"
      ? options.recordSecurityEvent
      : () => {};
  const runtime = buildRuntimeHandlers(options?.runtime);

  return async function handleConnectorRequest(req, res) {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");

    if (req.method === "OPTIONS") {
      recordRejectedRequest(
        recordEvent,
        recordSecurityEvent,
        req,
        url,
        "cors-preflight-blocked",
      );
      sendJson(res, 405, {
        ok: false,
        error: "Connector does not support browser preflight requests.",
      });
      return;
    }

    if (!isBrowserOriginAllowed(req)) {
      recordRejectedRequest(
        recordEvent,
        recordSecurityEvent,
        req,
        url,
        "browser-origin-blocked",
      );
      sendJson(res, 403, {
        ok: false,
        error: "Connector rejects browser-originated requests.",
      });
      return;
    }

    const connectorManifest = getConnectorManifest();
    if (!connectorManifest?.token) {
      sendJson(res, 503, {
        ok: false,
        error: "Connector bridge is not ready.",
      });
      return;
    }

    if (getRequestToken(req) !== connectorManifest.token) {
      recordRejectedRequest(
        recordEvent,
        recordSecurityEvent,
        req,
        url,
        "invalid-token",
      );
      sendJson(res, 401, {
        ok: false,
        error: "Unauthorized connector request.",
      });
      return;
    }

    try {
      if (req.method === "GET" && url.pathname === "/v1/connector/health") {
        const state = runtime.getSerializedOpenClawState();
        sendJson(res, 200, {
          ok: true,
          connector: {
            ...stripConnectorManifest(connectorManifest),
            version: getAppVersion(),
          },
          connectionState: state.connectionState,
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/v1/openclaw/status") {
        const state = runtime.getSerializedOpenClawState();
        const runtimeInsights = await runtime.getOpenClawRuntimeInsights();
        sendJson(res, 200, {
          ok: true,
          state,
          connectionState: state.connectionState,
          runtimeInsights,
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/v1/openclaw/support-snapshot") {
        const snapshot = await runtime.getOpenClawSupportSnapshot({
          limit: parseOptionalNumber(url.searchParams.get("limit")),
          turnJournalLimit: parseOptionalNumber(url.searchParams.get("turnJournalLimit")),
          browserMemoryLimit: parseOptionalNumber(url.searchParams.get("browserMemoryLimit")),
          threadId: normalizeNonEmptyString(url.searchParams.get("threadId")) || undefined,
          status: normalizeNonEmptyString(url.searchParams.get("status")) || undefined,
          memoryQuery:
            normalizeNonEmptyString(url.searchParams.get("memoryQuery")) || undefined,
        });
        sendJson(res, 200, snapshot);
        return;
      }

      if (req.method === "GET" && url.pathname === "/v1/openclaw/doctor") {
        const report = await runtime.doctorOpenClaw({
          target: normalizeNonEmptyString(url.searchParams.get("target")) || undefined,
          driver: normalizeNonEmptyString(url.searchParams.get("driver")) || undefined,
          profile: normalizeNonEmptyString(url.searchParams.get("profile")) || undefined,
          stateDir: normalizeNonEmptyString(url.searchParams.get("stateDir")) || undefined,
          sshTarget: normalizeNonEmptyString(url.searchParams.get("sshTarget")) || undefined,
          sshPort: parseOptionalNumber(url.searchParams.get("sshPort")),
          relayUrl: normalizeNonEmptyString(url.searchParams.get("relayUrl")) || undefined,
          connectCode:
            normalizeNonEmptyString(url.searchParams.get("connectCode")) || undefined,
          label: normalizeNonEmptyString(url.searchParams.get("label")) || undefined,
          agentId: normalizeNonEmptyString(url.searchParams.get("agentId")) || undefined,
        });
        sendJson(res, 200, { ok: true, report });
        return;
      }

      if (req.method === "GET" && url.pathname === "/v1/openclaw/probe") {
        const probe = await runtime.probeOpenClawConnection({
          target: normalizeNonEmptyString(url.searchParams.get("target")) || undefined,
          driver: normalizeNonEmptyString(url.searchParams.get("driver")) || undefined,
          profile: normalizeNonEmptyString(url.searchParams.get("profile")) || undefined,
          stateDir: normalizeNonEmptyString(url.searchParams.get("stateDir")) || undefined,
          sshTarget: normalizeNonEmptyString(url.searchParams.get("sshTarget")) || undefined,
          sshPort: parseOptionalNumber(url.searchParams.get("sshPort")),
          relayUrl: normalizeNonEmptyString(url.searchParams.get("relayUrl")) || undefined,
          connectCode:
            normalizeNonEmptyString(url.searchParams.get("connectCode")) || undefined,
          label: normalizeNonEmptyString(url.searchParams.get("label")) || undefined,
          agentId: normalizeNonEmptyString(url.searchParams.get("agentId")) || undefined,
        });
        sendJson(res, 200, { ok: true, probe });
        return;
      }

      if (req.method === "GET" && url.pathname === "/v1/openclaw/relay-pairing") {
        const state = await runtime.getOpenClawRelayPairingState({
          relayUrl: normalizeNonEmptyString(url.searchParams.get("relayUrl")) || undefined,
          connectCode:
            normalizeNonEmptyString(url.searchParams.get("connectCode")) || undefined,
        });
        sendJson(res, 200, { ok: true, state });
        return;
      }

      if (req.method === "GET" && url.pathname === "/v1/openclaw/relay-envelopes") {
        const state = await runtime.listOpenClawRelayEnvelopes({
          relayUrl: normalizeNonEmptyString(url.searchParams.get("relayUrl")) || undefined,
          sessionId: normalizeNonEmptyString(url.searchParams.get("sessionId")) || undefined,
          recipient: normalizeNonEmptyString(url.searchParams.get("recipient")) || undefined,
          afterSeq: normalizeNonEmptyString(url.searchParams.get("afterSeq")) || undefined,
        });
        sendJson(res, 200, { ok: true, state });
        return;
      }

      if (req.method === "POST" && url.pathname === "/v1/openclaw/relay-pairing") {
        const payload = await readJsonBody(req);
        const state = await runtime.createOpenClawRelayConnectCode(payload ?? {});
        sendJson(res, 200, { ok: true, state });
        return;
      }

      if (req.method === "POST" && url.pathname === "/v1/openclaw/relay-envelopes") {
        const payload = await readJsonBody(req);
        const state = await runtime.sendOpenClawRelayEnvelope(payload ?? {});
        sendJson(res, 200, { ok: true, state });
        return;
      }

      if (req.method === "POST" && url.pathname === "/v1/openclaw/connect") {
        const payload = await readJsonBody(req);
        const state = await runtime.connectOpenClaw(payload ?? {});
        sendJson(res, 200, {
          ok: true,
          state,
          connectionState: state?.connectionState ?? null,
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/v1/openclaw/disconnect") {
        const payload = await readJsonBody(req);
        const state = await runtime.disconnectOpenClaw(payload ?? {});
        sendJson(res, 200, {
          ok: true,
          state,
          connectionState: state?.connectionState ?? null,
        });
        return;
      }

      sendJson(res, 404, {
        ok: false,
        error: "Connector route not found.",
      });
    } catch (error) {
      const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
      const responseMessage =
        statusCode >= 500
          ? "Connector request failed."
          : normalizeNonEmptyString(error?.message) || "Connector request failed.";

      recordEvent("error", "Sabrina connector request failed", {
        method: req.method,
        path: url.pathname,
        statusCode,
        error: error instanceof Error ? error.message : String(error),
      });

      sendJson(res, statusCode, {
        ok: false,
        error: responseMessage,
      });
    }
  };
}

export function configureConnectorServer(server) {
  if (!server || typeof server !== "object") {
    throw new Error("A valid HTTP server instance is required.");
  }

  server.requestTimeout = CONNECTOR_REQUEST_TIMEOUT_MS;
  server.headersTimeout = CONNECTOR_HEADERS_TIMEOUT_MS;
  server.keepAliveTimeout = CONNECTOR_KEEP_ALIVE_TIMEOUT_MS;
  server.maxHeadersCount = 32;
  server.on("clientError", (_error, socket) => {
    if (socket.writable) {
      socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
    }
  });
  return server;
}

export async function writeConnectorManifestFile(manifest, options = {}) {
  const manifestPath =
    normalizeNonEmptyString(options?.manifestPath) || resolveSabrinaConnectorManifestPath();
  const directory = path.dirname(manifestPath);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700).catch(() => {});
  await writeFile(`${manifestPath}`, `${JSON.stringify(manifest, null, 2)}\n`, {
    mode: 0o600,
  });
  await chmod(manifestPath, 0o600).catch(() => {});
  return manifestPath;
}

export async function removeConnectorManifestFile(manifestPath, token) {
  const normalizedPath = normalizeNonEmptyString(manifestPath);
  if (!normalizedPath) {
    return;
  }

  try {
    const currentRaw = await readFile(normalizedPath, "utf8");
    const current = JSON.parse(currentRaw);
    if (current?.token === token) {
      await rm(normalizedPath, { force: true });
    }
  } catch {
    // Best effort cleanup only.
  }
}

export function createTestRequest({
  method = "GET",
  url = "/",
  headers = {},
  body = "",
} = {}) {
  const chunks = body ? [Buffer.from(body)] : [];
  return {
    method,
    url,
    headers,
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}
