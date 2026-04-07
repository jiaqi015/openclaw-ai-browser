import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  createSabrinaConnectCode,
  createSabrinaPairingSession,
  normalizeSabrinaConnectCode,
  normalizeSabrinaRelayUrl,
  normalizeSabrinaTransport,
  resolveSabrinaConnectorDevicePath,
  resolveSabrinaConnectorPairingsPath,
} from "../../packages/sabrina-protocol/index.mjs";
import {
  getSabrinaRelayPairingRemoteState,
  getSabrinaRelayPairingRemoteStateByCode,
  publishSabrinaRelayPairingSession,
} from "./relay/SabrinaRelayClient.mjs";

const DEFAULT_PAIRING_TTL_MS = 2 * 60_000;
const CONNECT_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function simplifyHostname(hostname = os.hostname()) {
  return `${hostname ?? ""}`.trim().replace(/\.local$/i, "") || "local-machine";
}

function createShortCode(length = 6) {
  let result = "";
  for (let index = 0; index < length; index += 1) {
    result += CONNECT_CODE_ALPHABET[crypto.randomInt(0, CONNECT_CODE_ALPHABET.length)];
  }
  return result;
}

async function readJsonFile(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeJsonFile(filePath, payload) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await writeFile(`${filePath}`, `${JSON.stringify(payload, null, 2)}\n`, {
    mode: 0o600,
  });
}

function normalizePairingStatus(status) {
  if (
    status === "active" ||
    status === "expired" ||
    status === "rejected" ||
    status === "pending"
  ) {
    return status;
  }
  return "pending";
}

function normalizeStoredPairing(entry = {}) {
  return createSabrinaPairingSession({
    ...entry,
    status: normalizePairingStatus(entry?.status),
  });
}

function createBrowserDeviceRecord(input = {}) {
  const createdAt =
    typeof input?.createdAt === "string" && input.createdAt.trim()
      ? input.createdAt.trim()
      : new Date().toISOString();
  return {
    deviceId: `${input?.deviceId ?? ""}`.trim() || `sabrina-${crypto.randomUUID()}`,
    displayName:
      `${input?.displayName ?? ""}`.trim() || `Sabrina @ ${simplifyHostname()}`,
    createdAt,
    updatedAt:
      typeof input?.updatedAt === "string" && input.updatedAt.trim()
        ? input.updatedAt.trim()
        : createdAt,
  };
}

async function ensureBrowserDeviceRecord(homeDir = os.homedir()) {
  const devicePath = resolveSabrinaConnectorDevicePath(homeDir);
  const stored = await readJsonFile(devicePath);
  const device = createBrowserDeviceRecord(stored);
  if (
    stored?.deviceId !== device.deviceId ||
    stored?.displayName !== device.displayName ||
    stored?.updatedAt !== device.updatedAt
  ) {
    await writeJsonFile(devicePath, device);
  }
  return device;
}

async function loadPairingStore(homeDir = os.homedir()) {
  const device = await ensureBrowserDeviceRecord(homeDir);
  const pairingPath = resolveSabrinaConnectorPairingsPath(homeDir);
  const raw = await readJsonFile(pairingPath);
  const sessions = Array.isArray(raw?.sessions)
    ? raw.sessions.map((entry) => normalizeStoredPairing(entry))
    : [];

  return {
    pairingPath,
    device,
    store: {
      schemaVersion: "1",
      updatedAt:
        typeof raw?.updatedAt === "string" && raw.updatedAt.trim()
          ? raw.updatedAt.trim()
          : new Date().toISOString(),
      sessions,
    },
  };
}

function isExpired(expiresAt, now = Date.now()) {
  const expiresAtMs = new Date(expiresAt).getTime();
  return !Number.isFinite(expiresAtMs) || expiresAtMs <= now;
}

function expireStaleSessions(store, now = Date.now()) {
  let changed = false;
  const sessions = store.sessions.map((session) => {
    if (session.status === "pending" && isExpired(session.expiresAt, now)) {
      changed = true;
      return {
        ...session,
        status: "expired",
      };
    }
    return session;
  });

  return {
    changed,
    store: {
      ...store,
      sessions,
      updatedAt: changed ? new Date(now).toISOString() : store.updatedAt,
    },
  };
}

function buildRelayConnectCodeView(session, device) {
  if (!session) {
    return null;
  }

  const connectCode = createSabrinaConnectCode({
    code: session.connectCode,
    deviceId: device.deviceId,
    transport: normalizeSabrinaTransport(session.transport),
    driver: session.driver,
    relayUrl: session.relayUrl,
    pairingId: session.pairingId,
    expiresAt: session.expiresAt,
  });

  return {
    pairingId: session.pairingId,
    status: session.status,
    relayUrl: session.relayUrl,
    browserDeviceId: device.deviceId,
    browserDisplayName: device.displayName,
    openclawDeviceId: session.openclawDeviceId ?? null,
    openclawLabel: session.openclawLabel ?? null,
    code: connectCode.code,
    expiresAt: connectCode.expiresAt,
    requestedAt: session.requestedAt,
    claimedAt: session.claimedAt ?? null,
    sessionId: session.sessionId ?? null,
  };
}

function findReusableRelaySession(sessions, relayUrl, now = Date.now()) {
  return (
    sessions
      .filter(
        (session) =>
          session.status === "pending" &&
          session.relayUrl === relayUrl &&
          !isExpired(session.expiresAt, now),
      )
      .sort((left, right) => {
        const rightTs = new Date(right.requestedAt).getTime();
        const leftTs = new Date(left.requestedAt).getTime();
        return rightTs - leftTs;
      })[0] ?? null
  );
}

function findRelaySessionByCode(sessions, relayUrl, connectCode) {
  const normalizedCode = normalizeSabrinaConnectCode(connectCode);
  if (!normalizedCode) {
    return null;
  }

  return (
    sessions.find(
      (session) =>
        session.relayUrl === relayUrl && session.connectCode === normalizedCode,
    ) ?? null
  );
}

function mergeRemotePairing(session, remotePairing = {}) {
  if (!session || !remotePairing || typeof remotePairing !== "object") {
    return session;
  }

  return createSabrinaPairingSession({
    ...session,
    status: remotePairing.status ?? session.status,
    openclawDeviceId:
      `${remotePairing.openclawDeviceId ?? session.openclawDeviceId ?? ""}`.trim() || null,
    openclawLabel:
      `${remotePairing.openclawLabel ?? session.openclawLabel ?? ""}`.trim() || null,
    claimedAt:
      typeof remotePairing.claimedAt === "string" && remotePairing.claimedAt.trim()
        ? remotePairing.claimedAt.trim()
        : session.claimedAt ?? null,
    sessionId: `${remotePairing.sessionId ?? session.sessionId ?? ""}`.trim() || null,
  });
}

export async function ensureSabrinaRelayConnectCode(params = {}) {
  const relayUrl = normalizeSabrinaRelayUrl(params?.relayUrl);
  if (!relayUrl) {
    throw new Error("生成连接码前需要先提供 relay URL。");
  }

  const ttlMs = Number.isFinite(Number(params?.ttlMs))
    ? Math.max(30_000, Math.trunc(Number(params.ttlMs)))
    : DEFAULT_PAIRING_TTL_MS;
  const now = Date.now();
  const homeDir = params?.homeDir ?? os.homedir();
  const { pairingPath, device, store: loadedStore } = await loadPairingStore(homeDir);
  const { changed: expiredChanged, store: storeAfterExpire } = expireStaleSessions(
    loadedStore,
    now,
  );
  const existing = findReusableRelaySession(storeAfterExpire.sessions, relayUrl, now);

  let nextStore = storeAfterExpire;
  let session = existing;
  if (!session) {
    session = createSabrinaPairingSession({
      pairingId: crypto.randomUUID(),
      transport: "remote",
      driver: "relay-paired",
      relayUrl,
      connectCode: createShortCode(),
      browserDeviceId: device.deviceId,
      requestedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
    });
    nextStore = {
      ...storeAfterExpire,
      updatedAt: new Date(now).toISOString(),
      sessions: [session, ...storeAfterExpire.sessions].slice(0, 50),
    };
  }

  if (expiredChanged || !existing) {
    await writeJsonFile(pairingPath, nextStore);
  }

  if (params?.publish === true) {
    const publishSession =
      typeof params?.publishSession === "function"
        ? params.publishSession
        : publishSabrinaRelayPairingSession;
    await publishSession(relayUrl, {
      pairingId: session.pairingId,
      code: session.connectCode,
      relayUrl,
      browserDeviceId: device.deviceId,
      browserDisplayName: device.displayName,
      requestedAt: session.requestedAt,
      expiresAt: session.expiresAt,
      status: session.status,
    });
  }

  return {
    ok: true,
    device,
    session: buildRelayConnectCodeView(session, device),
    sessions: nextStore.sessions.map((entry) => buildRelayConnectCodeView(entry, device)),
  };
}

export async function getSabrinaRelayPairingState(params = {}) {
  const relayUrl = normalizeSabrinaRelayUrl(params?.relayUrl);
  const connectCode = normalizeSabrinaConnectCode(params?.connectCode);
  const homeDir = params?.homeDir ?? os.homedir();
  const { pairingPath, device, store: loadedStore } = await loadPairingStore(homeDir);
  const { changed, store: expiredStore } = expireStaleSessions(loadedStore, Date.now());
  let store = expiredStore;
  let synced = false;

  const localSession =
    relayUrl && connectCode ? findRelaySessionByCode(store.sessions, relayUrl, connectCode) : null;

  if (relayUrl && (localSession || connectCode)) {
    try {
      const remotePayload = localSession
        ? await getSabrinaRelayPairingRemoteState(relayUrl, localSession.pairingId)
        : await getSabrinaRelayPairingRemoteStateByCode(relayUrl, connectCode);
      const remotePairing = remotePayload?.pairing ?? null;
      if (remotePairing?.pairingId) {
        const nextSessions = store.sessions.map((session) => {
          if (session.pairingId !== remotePairing.pairingId) {
            return session;
          }
          const merged = mergeRemotePairing(session, remotePairing);
          if (JSON.stringify(merged) !== JSON.stringify(session)) {
            synced = true;
          }
          return merged;
        });

        if (!nextSessions.some((session) => session.pairingId === remotePairing.pairingId)) {
          nextSessions.unshift(
            mergeRemotePairing(
              createSabrinaPairingSession({
                pairingId: remotePairing.pairingId,
                transport: "remote",
                driver: "relay-paired",
                relayUrl,
                connectCode: remotePairing.code,
                browserDeviceId: device.deviceId,
                requestedAt: remotePairing.requestedAt,
                expiresAt: remotePairing.expiresAt,
              }),
              remotePairing,
            ),
          );
          synced = true;
        }

        if (synced) {
          store = {
            ...store,
            updatedAt: new Date().toISOString(),
            sessions: nextSessions.slice(0, 50),
          };
        }
      }
    } catch {
      // Relay lookup is best-effort. Local state still drives the current UI if the relay is unreachable.
    }
  }

  if (changed || synced) {
    await writeJsonFile(pairingPath, store);
  }

  const sessions = store.sessions
    .filter(
      (session) =>
        (!relayUrl || session.relayUrl === relayUrl) &&
        (!connectCode || session.connectCode === connectCode),
    )
    .map((entry) => buildRelayConnectCodeView(entry, device));

  return {
    ok: true,
    device,
    active:
      sessions.find((session) => session?.status === "active") ??
      sessions.find((session) => session?.status === "pending") ??
      null,
    sessions,
  };
}

export async function markSabrinaRelayPairingActive(params = {}) {
  const pairingId = `${params?.pairingId ?? ""}`.trim();
  if (!pairingId) {
    throw new Error("缺少 pairingId。");
  }

  const homeDir = params?.homeDir ?? os.homedir();
  const { pairingPath, device, store: loadedStore } = await loadPairingStore(homeDir);
  const { store } = expireStaleSessions(loadedStore, Date.now());
  let updated = false;
  const sessions = store.sessions.map((session) => {
    if (session.pairingId !== pairingId) {
      return session;
    }
    updated = true;
    return {
      ...session,
      status: "active",
      openclawDeviceId:
        `${params?.openclawDeviceId ?? session.openclawDeviceId ?? ""}`.trim() || null,
      openclawLabel:
        `${params?.openclawLabel ?? session.openclawLabel ?? ""}`.trim() || null,
      claimedAt:
        typeof params?.claimedAt === "string" && params.claimedAt.trim()
          ? params.claimedAt.trim()
          : session.claimedAt ?? new Date().toISOString(),
      sessionId: `${params?.sessionId ?? session.sessionId ?? ""}`.trim() || null,
    };
  });

  if (!updated) {
    throw new Error(`未找到 relay pairing: ${pairingId}`);
  }

  const nextStore = {
    ...store,
    updatedAt: new Date().toISOString(),
    sessions,
  };
  await writeJsonFile(pairingPath, nextStore);
  const session = sessions.find((entry) => entry.pairingId === pairingId) ?? null;
  return {
    ok: true,
    device,
    session: buildRelayConnectCodeView(session, device),
  };
}
