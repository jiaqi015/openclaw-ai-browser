import os from "node:os";
import path from "node:path";
import {
  normalizeOpenClawProfile,
  normalizeOpenClawStateDir,
  normalizeSabrinaConnectCode,
  normalizeSabrinaRelayUrl,
  normalizeSabrinaRemoteDriver,
  normalizeSabrinaTransport,
} from "../../packages/sabrina-protocol/index.mjs";

function normalizeOpenClawDriver(value, transportHint = "local") {
  const normalizedRemoteDriver = normalizeSabrinaRemoteDriver(value);
  if (normalizedRemoteDriver) {
    return normalizedRemoteDriver;
  }
  const normalized = `${value ?? ""}`.trim();
  if (normalized === "local-cli") {
    return "local-cli";
  }
  return normalizeSabrinaTransport(transportHint) === "remote" ? "ssh-cli" : "local-cli";
}

function normalizeSshTarget(value) {
  const normalized = `${value ?? ""}`.trim();
  return normalized || null;
}

function normalizeSshPort(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return Math.trunc(numeric);
}

function normalizeOpenClawLabel(value) {
  const normalized = `${value ?? ""}`.trim();
  return normalized || null;
}

function normalizeRelayUrl(value) {
  return normalizeSabrinaRelayUrl(value);
}

function normalizeConnectCode(value) {
  return normalizeSabrinaConnectCode(value);
}

function normalizeOpenClawAgentId(value) {
  const normalized = `${value ?? ""}`.trim();
  return normalized || null;
}

let transportContext = Object.freeze({
  transport: "local",
  driver: "local-cli",
  profile: normalizeOpenClawProfile(process.env.OPENCLAW_PROFILE),
  stateDir: normalizeOpenClawStateDir(process.env.OPENCLAW_STATE_DIR),
  sshTarget: null,
  sshPort: null,
  relayUrl: null,
  connectCode: null,
  label: null,
  agentId: null,
});

export function getOpenClawTransportContext() {
  return { ...transportContext };
}

export function setOpenClawTransportContext(nextContext = {}) {
  const transport = normalizeSabrinaTransport(nextContext.transport ?? transportContext.transport);
  transportContext = Object.freeze({
    transport,
    driver: normalizeOpenClawDriver(nextContext.driver ?? transportContext.driver, transport),
    profile: normalizeOpenClawProfile(nextContext.profile ?? transportContext.profile),
    stateDir: normalizeOpenClawStateDir(nextContext.stateDir ?? transportContext.stateDir),
    sshTarget: normalizeSshTarget(nextContext.sshTarget ?? transportContext.sshTarget),
    sshPort: normalizeSshPort(nextContext.sshPort ?? transportContext.sshPort),
    relayUrl: normalizeRelayUrl(nextContext.relayUrl ?? transportContext.relayUrl),
    connectCode: normalizeConnectCode(nextContext.connectCode ?? transportContext.connectCode),
    label: normalizeOpenClawLabel(nextContext.label ?? transportContext.label),
    agentId: normalizeOpenClawAgentId(nextContext.agentId ?? transportContext.agentId),
  });
  return getOpenClawTransportContext();
}

export function resolveOpenClawStateDirFromContext(context = transportContext) {
  const normalizedStateDir = normalizeOpenClawStateDir(context?.stateDir);
  if (normalizedStateDir) {
    return normalizedStateDir;
  }

  const normalizedEnvStateDir = normalizeOpenClawStateDir(process.env.OPENCLAW_STATE_DIR);
  if (normalizedEnvStateDir) {
    return normalizedEnvStateDir;
  }

  if (isOpenClawRemoteTransportContext(context)) {
    const normalizedProfile = normalizeOpenClawProfile(
      context?.profile ?? process.env.OPENCLAW_PROFILE,
    );
    if (normalizedProfile) {
      return `~/.openclaw-${normalizedProfile}`;
    }
    return "~/.openclaw";
  }

  const normalizedProfile = normalizeOpenClawProfile(context?.profile ?? process.env.OPENCLAW_PROFILE);
  if (normalizedProfile) {
    return path.join(os.homedir(), `.openclaw-${normalizedProfile}`);
  }

  return path.join(os.homedir(), ".openclaw");
}

export function resolveOpenClawConfigPathFromContext(context = transportContext) {
  return path.join(resolveOpenClawStateDirFromContext(context), "openclaw.json");
}

export function buildOpenClawExecArgs(args = [], context = transportContext) {
  const normalizedArgs = Array.isArray(args) ? args.filter(Boolean) : [];
  const normalizedProfile = normalizeOpenClawProfile(context?.profile);
  if (!normalizedProfile) {
    return normalizedArgs;
  }

  return ["--profile", normalizedProfile, ...normalizedArgs];
}

export function buildOpenClawExecOptions(options = {}, context = transportContext) {
  const normalizedStateDir = normalizeOpenClawStateDir(context?.stateDir);
  const env = {
    ...process.env,
    ...(options?.env ?? {}),
  };

  if (
    normalizedStateDir &&
    !isOpenClawRemoteTransportContext(context)
  ) {
    env.OPENCLAW_STATE_DIR = normalizedStateDir;
  }

  return {
    ...options,
    env,
  };
}

export function getOpenClawTransportLabel(context = transportContext) {
  const normalizedLabel = normalizeOpenClawLabel(context?.label);
  if (normalizedLabel) {
    return normalizedLabel;
  }

  const sshTarget = normalizeSshTarget(context?.sshTarget);
  if (sshTarget) {
    return sshTarget;
  }

  const relayUrl = normalizeRelayUrl(context?.relayUrl);
  if (relayUrl) {
    return relayUrl;
  }

  const normalizedProfile = normalizeOpenClawProfile(context?.profile);
  if (normalizedProfile) {
    return `profile:${normalizedProfile}`;
  }

  const resolvedStateDir = resolveOpenClawStateDirFromContext(context);
  return path.basename(resolvedStateDir) || resolvedStateDir;
}

export function getOpenClawRemoteDriver(context = transportContext) {
  const driver = normalizeOpenClawDriver(context?.driver, context?.transport);
  return driver === "local-cli" ? null : driver;
}

export function getOpenClawRemoteTargetRef(context = transportContext) {
  const driver = getOpenClawRemoteDriver(context);
  if (driver === "ssh-cli") {
    return normalizeSshTarget(context?.sshTarget);
  }
  if (driver === "relay-paired") {
    return normalizeRelayUrl(context?.relayUrl);
  }
  return null;
}

export function isOpenClawRemoteTransportContext(context = transportContext) {
  return Boolean(getOpenClawRemoteDriver(context));
}

export function isOpenClawSshTransportContext(context = transportContext) {
  return getOpenClawRemoteDriver(context) === "ssh-cli";
}
