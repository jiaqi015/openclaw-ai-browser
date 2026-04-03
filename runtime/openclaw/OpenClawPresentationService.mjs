import os from "node:os";
import {
  SABRINA_LOCAL_CAPABILITIES,
  SABRINA_PROTOCOL_VERSION,
  normalizeOpenClawProfile,
  normalizeOpenClawStateDir,
} from "../../packages/sabrina-protocol/index.mjs";
import {
  getCurrentUiLocale,
  normalizeUiLocale,
  translate,
} from "../../shared/localization.mjs";
import { resolveOpenClawStateDir } from "./OpenClawConfigCache.mjs";
import { getOpenClawTransportContext } from "./OpenClawTransportContext.mjs";

const DEFAULT_BROWSER_AGENT_NAME = "Saburina Browser";

export function getAgentLabel(agentRecord) {
  if (typeof agentRecord?.identity?.name === "string" && agentRecord.identity.name.trim()) {
    return agentRecord.identity.name.trim();
  }

  if (typeof agentRecord?.name === "string" && agentRecord.name.trim()) {
    return agentRecord.name.trim();
  }

  if (typeof agentRecord?.id === "string" && agentRecord.id.trim()) {
    return agentRecord.id.trim();
  }

  return DEFAULT_BROWSER_AGENT_NAME;
}

export function formatLocalTimestamp(input) {
  const locale = getCurrentUiLocale();
  if (!input) {
    return translate(locale, "openclaw.presentation.unknown");
  }

  const date = typeof input === "number" ? new Date(input) : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return translate(locale, "openclaw.presentation.unknown");
  }

  return new Intl.DateTimeFormat(normalizeUiLocale(locale), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function simplifyHostLabel(hostname = os.hostname()) {
  return hostname.replace(/\.local$/i, "");
}

export function prettifyScope(scope) {
  return scope
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildLocalBindingRecord(params = {}) {
  const locale = getCurrentUiLocale();
  const {
    device,
    deviceAuth,
    agentId,
    agentRecord,
    gateway,
    gatewayReachable,
    gatewayHealthDetail = "",
    healthSummary = "",
    hostLabel = simplifyHostLabel(),
  } = params;

  const tokenEntries = Object.values(deviceAuth?.tokens ?? {}).filter(Boolean);
  const flattenedScopes = Array.from(
    new Set(tokenEntries.flatMap((entry) => entry?.scopes ?? [])),
  );
  const transportContext = getOpenClawTransportContext();
  const openclawProfile = normalizeOpenClawProfile(transportContext.profile);
  const openclawStateDir = normalizeOpenClawStateDir(transportContext.stateDir) ?? resolveOpenClawStateDir();
  const bindingSeed = device?.deviceId ?? hostLabel ?? "local";
  const pairedAtMs =
    tokenEntries
      .map((entry) => entry?.updatedAtMs)
      .find((value) => typeof value === "number") ??
    device?.createdAtMs ??
    null;

  return {
    bindingId: `binding-local-${openclawProfile ?? "default"}-${bindingSeed}`,
    protocolVersion: SABRINA_PROTOCOL_VERSION,
    agentId,
    lobsterId: device?.deviceId ?? `openclaw-${hostLabel}`,
    displayName: `${getAgentLabel(agentRecord)} @ ${hostLabel}`,
    mode: "local",
    status: gatewayReachable ? "active" : "disconnected",
    gatewayUrl: gateway.url,
    deviceId: device?.deviceId ?? translate(locale, "openclaw.presentation.noDeviceIdentity"),
    hostLabel,
    openclawProfile,
    openclawStateDir,
    capabilities: [...SABRINA_LOCAL_CAPABILITIES],
    note: gatewayReachable
      ? translate(locale, "openclaw.presentation.localNoteConnected", {
          agentId,
          health: healthSummary || translate(locale, "openclaw.presentation.gatewayReachable"),
        }).trim()
      : translate(locale, "openclaw.presentation.localNoteDisconnected", {
          agentId,
          detail: gatewayHealthDetail ? `(${gatewayHealthDetail})` : "",
        }).trim(),
    scopes: flattenedScopes.length
      ? flattenedScopes.map((scope) => ({
          id: scope,
          label: prettifyScope(scope),
          description: translate(locale, "openclaw.presentation.scope.deviceToken"),
        }))
      : [
          {
            id: "operator.read",
            label: translate(locale, "openclaw.presentation.noDeviceScopesLabel"),
            description: translate(locale, "openclaw.presentation.noDeviceScopesDescription"),
          },
        ],
    pairedAt: formatLocalTimestamp(pairedAtMs),
    lastConnectedAt: gatewayReachable ? formatLocalTimestamp(Date.now()) : undefined,
  };
}

export function buildRemoteBindingRecord(params = {}) {
  const locale = getCurrentUiLocale();
  const agentId = `${params?.agentId ?? ""}`.trim() || "main";
  const driver = `${params?.driver ?? "remote"}`.trim() || "remote";
  const remoteTarget = `${params?.sshTarget ?? params?.relayUrl ?? ""}`.trim();
  const remoteLabel = `${params?.displayLabel ?? ""}`.trim() || remoteTarget || "remote-openclaw";
  const remoteRef = `${remoteTarget || remoteLabel}`.trim();
  const gatewayReachable = params?.gatewayReachable === true;
  const agentRecord = params?.agentRecord ?? null;

  return {
    bindingId: `binding-remote-${remoteRef.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
    protocolVersion: SABRINA_PROTOCOL_VERSION,
    agentId,
    lobsterId: `remote:${remoteRef}`,
    displayName: `${getAgentLabel(agentRecord)} @ ${remoteLabel}`,
    mode: "remote",
    status: gatewayReachable ? "active" : "disconnected",
    gatewayUrl: `${driver}://${remoteRef}`,
    deviceId: `${driver}:${remoteRef}`,
    hostLabel: remoteLabel,
    openclawProfile: normalizeOpenClawProfile(params?.openclawProfile),
    openclawStateDir: normalizeOpenClawStateDir(params?.openclawStateDir),
    capabilities: [...SABRINA_LOCAL_CAPABILITIES],
    note: gatewayReachable
      ? translate(locale, "openclaw.presentation.remoteNoteConnected", {
          driver,
          agentId,
        })
      : translate(locale, "openclaw.presentation.remoteNoteDisconnected"),
    scopes: [
      {
        id: "remote.control",
        label: translate(locale, "openclaw.presentation.scope.remoteControlLabel"),
        description: translate(locale, "openclaw.presentation.scope.remoteControl"),
      },
    ],
    pairedAt: formatLocalTimestamp(Date.now()),
    lastConnectedAt: gatewayReachable ? formatLocalTimestamp(Date.now()) : undefined,
  };
}
