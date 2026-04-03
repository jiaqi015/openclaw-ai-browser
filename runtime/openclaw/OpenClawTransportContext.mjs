import os from "node:os";
import path from "node:path";
import {
  normalizeOpenClawProfile,
  normalizeOpenClawStateDir,
  normalizeSabrinaTransport,
} from "../../packages/sabrina-protocol/index.mjs";

function normalizeOpenClawDriver(value, transportHint = "local") {
  const normalized = `${value ?? ""}`.trim();
  if (normalized === "ssh-cli") {
    return "ssh-cli";
  }
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

  if (normalizeOpenClawDriver(context?.driver, context?.transport) === "ssh-cli") {
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
    normalizeOpenClawDriver(context?.driver, context?.transport) !== "ssh-cli"
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

  const normalizedProfile = normalizeOpenClawProfile(context?.profile);
  if (normalizedProfile) {
    return `profile:${normalizedProfile}`;
  }

  const resolvedStateDir = resolveOpenClawStateDirFromContext(context);
  return path.basename(resolvedStateDir) || resolvedStateDir;
}

export function isOpenClawSshTransportContext(context = transportContext) {
  return normalizeOpenClawDriver(context?.driver, context?.transport) === "ssh-cli";
}
