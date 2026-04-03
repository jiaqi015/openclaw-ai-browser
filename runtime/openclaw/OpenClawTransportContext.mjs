import os from "node:os";
import path from "node:path";
import {
  normalizeOpenClawProfile,
  normalizeOpenClawStateDir,
  normalizeSabrinaTransport,
} from "../../packages/sabrina-protocol/index.mjs";

let transportContext = Object.freeze({
  transport: "local",
  profile: normalizeOpenClawProfile(process.env.OPENCLAW_PROFILE),
  stateDir: normalizeOpenClawStateDir(process.env.OPENCLAW_STATE_DIR),
});

export function getOpenClawTransportContext() {
  return { ...transportContext };
}

export function setOpenClawTransportContext(nextContext = {}) {
  transportContext = Object.freeze({
    transport: normalizeSabrinaTransport(nextContext.transport ?? transportContext.transport),
    profile: normalizeOpenClawProfile(nextContext.profile ?? transportContext.profile),
    stateDir: normalizeOpenClawStateDir(nextContext.stateDir ?? transportContext.stateDir),
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

  if (normalizedStateDir) {
    env.OPENCLAW_STATE_DIR = normalizedStateDir;
  }

  return {
    ...options,
    env,
  };
}

export function getOpenClawTransportLabel(context = transportContext) {
  const normalizedProfile = normalizeOpenClawProfile(context?.profile);
  if (normalizedProfile) {
    return `profile:${normalizedProfile}`;
  }

  const resolvedStateDir = resolveOpenClawStateDirFromContext(context);
  return path.basename(resolvedStateDir) || resolvedStateDir;
}
