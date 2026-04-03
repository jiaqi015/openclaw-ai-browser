import os from "node:os";
import {
  SABRINA_LOCAL_CAPABILITIES,
  SABRINA_PROTOCOL_VERSION,
  normalizeOpenClawProfile,
  normalizeOpenClawStateDir,
} from "../../packages/sabrina-protocol/index.mjs";
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
  if (!input) {
    return "未知";
  }

  const date = typeof input === "number" ? new Date(input) : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "未知";
  }

  return new Intl.DateTimeFormat("zh-CN", {
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
    deviceId: device?.deviceId ?? "未发现设备身份",
    hostLabel,
    openclawProfile,
    openclawStateDir,
    capabilities: [...SABRINA_LOCAL_CAPABILITIES],
    note: gatewayReachable
      ? `已连接本机龙虾。浏览器会话使用独立代理 ${agentId}。${healthSummary || "网关可达。"}`
      : `已读取本机龙虾配置，浏览器代理为 ${agentId}，但当前无法使用本机网关。${gatewayHealthDetail ? `（${gatewayHealthDetail}）` : ""}`,
    scopes: flattenedScopes.length
      ? flattenedScopes.map((scope) => ({
          id: scope,
          label: prettifyScope(scope),
          description: "来自本机 OpenClaw 设备授权 token 的真实 scope。",
        }))
      : [
          {
            id: "operator.read",
            label: "No Device Scopes",
            description: "当前未检测到设备授权 scopes。",
          },
        ],
    pairedAt: formatLocalTimestamp(pairedAtMs),
    lastConnectedAt: gatewayReachable ? formatLocalTimestamp(Date.now()) : undefined,
  };
}

export function buildRemoteBindingRecord(params = {}) {
  const agentId = `${params?.agentId ?? ""}`.trim() || "main";
  const remoteLabel = `${params?.displayLabel ?? params?.sshTarget ?? "remote-openclaw"}`.trim();
  const sshTarget = `${params?.sshTarget ?? remoteLabel}`.trim();
  const gatewayReachable = params?.gatewayReachable === true;
  const agentRecord = params?.agentRecord ?? null;

  return {
    bindingId: `binding-remote-${sshTarget.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
    protocolVersion: SABRINA_PROTOCOL_VERSION,
    agentId,
    lobsterId: `remote:${sshTarget}`,
    displayName: `${getAgentLabel(agentRecord)} @ ${remoteLabel}`,
    mode: "remote",
    status: gatewayReachable ? "active" : "disconnected",
    gatewayUrl: `ssh://${sshTarget}`,
    deviceId: `ssh:${sshTarget}`,
    hostLabel: remoteLabel,
    openclawProfile: normalizeOpenClawProfile(params?.openclawProfile),
    openclawStateDir: normalizeOpenClawStateDir(params?.openclawStateDir),
    capabilities: [...SABRINA_LOCAL_CAPABILITIES],
    note: gatewayReachable
      ? `已连接远程 OpenClaw。浏览器通过 SSH 复用代理 ${agentId}。`
      : `已读取远程 OpenClaw 配置，但当前无法通过 SSH 验证网关。`,
    scopes: [
      {
        id: "ssh.control",
        label: "SSH Control",
        description: "通过 SSH 复用远程 OpenClaw 控制面。",
      },
    ],
    pairedAt: formatLocalTimestamp(Date.now()),
    lastConnectedAt: gatewayReachable ? formatLocalTimestamp(Date.now()) : undefined,
  };
}
