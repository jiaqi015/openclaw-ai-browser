import http from "node:http";
import { fileURLToPath } from "node:url";
import { createSabrinaRemoteEnvelope } from "../../sabrina-protocol/index.mjs";

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

function normalizeTimestamp(value, fallback = new Date().toISOString()) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function isExpired(expiresAt, now = Date.now()) {
  const expiresAtMs = new Date(expiresAt).getTime();
  return !Number.isFinite(expiresAtMs) || expiresAtMs <= now;
}

function createRelayStore() {
  const pairingsById = new Map();
  const pairingsByCode = new Map();
  const pairingsBySessionId = new Map();
  const envelopesBySessionId = new Map();

  function upsertPairing(rawPairing = {}) {
    const pairing = {
      pairingId: `${rawPairing.pairingId ?? ""}`.trim(),
      code: `${rawPairing.code ?? ""}`.trim().toUpperCase(),
      relayUrl: `${rawPairing.relayUrl ?? ""}`.trim() || null,
      browserDeviceId: `${rawPairing.browserDeviceId ?? ""}`.trim() || null,
      browserDisplayName: `${rawPairing.browserDisplayName ?? ""}`.trim() || null,
      openclawDeviceId: `${rawPairing.openclawDeviceId ?? ""}`.trim() || null,
      openclawLabel: `${rawPairing.openclawLabel ?? ""}`.trim() || null,
      status:
        rawPairing.status === "active" ||
        rawPairing.status === "expired" ||
        rawPairing.status === "rejected"
          ? rawPairing.status
          : "pending",
      requestedAt: normalizeTimestamp(rawPairing.requestedAt),
      expiresAt: normalizeTimestamp(
        rawPairing.expiresAt,
        new Date(Date.now() + 2 * 60_000).toISOString(),
      ),
      claimedAt:
        typeof rawPairing.claimedAt === "string" && rawPairing.claimedAt.trim()
          ? rawPairing.claimedAt.trim()
          : null,
      sessionId: `${rawPairing.sessionId ?? ""}`.trim() || null,
    };

    if (!pairing.pairingId || !pairing.code) {
      throw new Error("Pairing requires pairingId and code.");
    }

    pairingsById.set(pairing.pairingId, pairing);
    pairingsByCode.set(pairing.code, pairing.pairingId);
    if (pairing.sessionId) {
      pairingsBySessionId.set(pairing.sessionId, pairing.pairingId);
      if (!envelopesBySessionId.has(pairing.sessionId)) {
        envelopesBySessionId.set(pairing.sessionId, []);
      }
    }
    return pairing;
  }

  function getPairingById(pairingId) {
    const normalizedId = `${pairingId ?? ""}`.trim();
    if (!normalizedId) return null;
    const pairing = pairingsById.get(normalizedId) ?? null;
    if (pairing && pairing.status === "pending" && isExpired(pairing.expiresAt)) {
      const expired = {
        ...pairing,
        status: "expired",
      };
      pairingsById.set(expired.pairingId, expired);
      return expired;
    }
    return pairing;
  }

  function getPairingByCode(code) {
    const normalizedCode = `${code ?? ""}`.trim().toUpperCase();
    if (!normalizedCode) return null;
    const pairingId = pairingsByCode.get(normalizedCode);
    return pairingId ? getPairingById(pairingId) : null;
  }

  function claimPairing(code, input = {}) {
    const pairing = getPairingByCode(code);
    if (!pairing) {
      throw new Error("Connect code not found.");
    }
    if (pairing.status === "expired" || isExpired(pairing.expiresAt)) {
      const expired = {
        ...pairing,
        status: "expired",
      };
      pairingsById.set(expired.pairingId, expired);
      throw new Error("Connect code expired.");
    }
    if (pairing.status === "rejected") {
      throw new Error("Connect code rejected.");
    }

    const active = upsertPairing({
      ...pairing,
      status: "active",
      claimedAt: new Date().toISOString(),
      sessionId: pairing.sessionId || `relay-session-${pairing.pairingId}`,
      openclawDeviceId: input.openclawDeviceId,
      openclawLabel: input.openclawLabel,
    });
    return active;
  }

  function getPairingBySessionId(sessionId) {
    const normalizedSessionId = `${sessionId ?? ""}`.trim();
    if (!normalizedSessionId) {
      return null;
    }
    const pairingId = pairingsBySessionId.get(normalizedSessionId);
    return pairingId ? getPairingById(pairingId) : null;
  }

  function appendEnvelope(sessionId, rawEnvelope = {}) {
    const pairing = getPairingBySessionId(sessionId);
    if (!pairing) {
      throw new Error("Relay session not found.");
    }

    const normalizedSessionId = `${sessionId ?? ""}`.trim();
    const existing = envelopesBySessionId.get(normalizedSessionId) ?? [];
    const envelope = createSabrinaRemoteEnvelope({
      ...rawEnvelope,
      sessionId: normalizedSessionId,
      seq: existing.length + 1,
    });
    const nextEnvelopes = [...existing, envelope].slice(-200);
    envelopesBySessionId.set(normalizedSessionId, nextEnvelopes);
    return envelope;
  }

  function listEnvelopes(sessionId, params = {}) {
    const normalizedSessionId = `${sessionId ?? ""}`.trim();
    if (!normalizedSessionId) {
      return [];
    }

    const afterSeq = Number.isFinite(Number(params.afterSeq))
      ? Math.max(0, Math.trunc(Number(params.afterSeq)))
      : 0;
    const recipient = `${params.recipient ?? ""}`.trim();
    return (envelopesBySessionId.get(normalizedSessionId) ?? []).filter((envelope) => {
      if (afterSeq > 0 && Number(envelope.seq) <= afterSeq) {
        return false;
      }
      if (recipient && envelope.to !== recipient) {
        return false;
      }
      return true;
    });
  }

  return {
    upsertPairing,
    getPairingById,
    getPairingByCode,
    getPairingBySessionId,
    claimPairing,
    appendEnvelope,
    listEnvelopes,
  };
}

export function createSabrinaRelayDevServer() {
  const store = createRelayStore();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");

    try {
      if (req.method === "GET" && url.pathname === "/v1/health") {
        sendJson(res, 200, { ok: true, service: "sabrina-relay-dev" });
        return;
      }

      if (req.method === "POST" && url.pathname === "/v1/pairings/register") {
        const payload = await readJsonBody(req);
        const pairing = store.upsertPairing(payload ?? {});
        sendJson(res, 200, {
          ok: true,
          pairing,
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/v1/pairings/claim") {
        const payload = await readJsonBody(req);
        const pairing = store.claimPairing(payload?.code, payload ?? {});
        sendJson(res, 200, {
          ok: true,
          pairing,
        });
        return;
      }

      if (req.method === "GET" && url.pathname.startsWith("/v1/pairings/by-code/")) {
        const code = decodeURIComponent(url.pathname.slice("/v1/pairings/by-code/".length));
        const pairing = store.getPairingByCode(code);
        if (!pairing) {
          sendJson(res, 404, { ok: false, error: "Pairing not found." });
          return;
        }
        sendJson(res, 200, { ok: true, pairing });
        return;
      }

      if (req.method === "GET" && url.pathname.startsWith("/v1/pairings/")) {
        const pairingId = decodeURIComponent(url.pathname.slice("/v1/pairings/".length));
        const pairing = store.getPairingById(pairingId);
        if (!pairing) {
          sendJson(res, 404, { ok: false, error: "Pairing not found." });
          return;
        }
        sendJson(res, 200, { ok: true, pairing });
        return;
      }

      if (
        req.method === "GET" &&
        url.pathname.startsWith("/v1/sessions/") &&
        url.pathname.endsWith("/envelopes")
      ) {
        const sessionId = decodeURIComponent(
          url.pathname.slice("/v1/sessions/".length, -"/envelopes".length),
        );
        const pairing = store.getPairingBySessionId(sessionId);
        if (!pairing) {
          sendJson(res, 404, { ok: false, error: "Relay session not found." });
          return;
        }
        const envelopes = store.listEnvelopes(sessionId, {
          recipient: url.searchParams.get("recipient") || undefined,
          afterSeq: url.searchParams.get("afterSeq") || undefined,
        });
        sendJson(res, 200, {
          ok: true,
          pairing,
          envelopes,
        });
        return;
      }

      if (
        req.method === "POST" &&
        url.pathname.startsWith("/v1/sessions/") &&
        url.pathname.endsWith("/envelopes")
      ) {
        const sessionId = decodeURIComponent(
          url.pathname.slice("/v1/sessions/".length, -"/envelopes".length),
        );
        const payload = await readJsonBody(req);
        const envelope = store.appendEnvelope(sessionId, payload ?? {});
        sendJson(res, 200, {
          ok: true,
          envelope,
        });
        return;
      }

      sendJson(res, 404, { ok: false, error: "Unknown relay route." });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return {
    server,
    async listen(port = 0, host = "127.0.0.1") {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => resolve());
      });
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Relay server did not expose a TCP address.");
      }
      return {
        host: address.address,
        port: address.port,
        url: `http://${address.address}:${address.port}`,
      };
    },
    async close() {
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

export async function startSabrinaRelayDevServer(options = {}) {
  const instance = createSabrinaRelayDevServer();
  const address = await instance.listen(options.port, options.host);
  return {
    ...instance,
    ...address,
  };
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const port = Number(process.env.PORT || process.env.SABRINA_RELAY_PORT || 0);
  const host = process.env.HOST || "127.0.0.1";
  const instance = await startSabrinaRelayDevServer({ port, host });
  console.log(`Sabrina relay dev listening on ${instance.url}`);
}
