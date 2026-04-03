import {
  SABRINA_LOCAL_CAPABILITIES,
  normalizeOpenClawProfile,
  normalizeOpenClawStateDir,
} from "../../packages/sabrina-protocol/index.mjs";
import { getOpenClawTransportLabel } from "./OpenClawTransportContext.mjs";

export function normalizeTarget(target) {
  return `${target ?? "local"}`.trim() === "remote" ? "remote" : "local";
}

export function createDefaultConnectionConfig(target = "local") {
  return {
    enabled: false,
    transport: normalizeTarget(target),
    profile: null,
    stateDir: null,
  };
}

export function normalizeConnectionConfig(rawConfig = {}, fallbackTarget = "local") {
  return {
    enabled: rawConfig?.enabled === true,
    transport: normalizeTarget(rawConfig?.transport ?? fallbackTarget),
    profile: normalizeOpenClawProfile(rawConfig?.profile),
    stateDir: normalizeOpenClawStateDir(rawConfig?.stateDir),
  };
}

export function createConnectionState(params = {}) {
  const target = normalizeTarget(params?.target);
  const config = normalizeConnectionConfig(params?.connectionConfig, target);
  const binding = params?.binding ?? null;
  const gatewayStatus = params?.gatewayStatus ?? null;
  const bindingSetupState = params?.bindingSetupState ?? null;
  const detailError = `${params?.lastError ?? ""}`.trim();
  const checkedAt =
    typeof params?.lastRefreshedAt === "string" && params.lastRefreshedAt.trim()
      ? params.lastRefreshedAt.trim()
      : null;
  const transportLabel = getOpenClawTransportLabel(config);
  const capabilities =
    Array.isArray(binding?.capabilities) && binding.capabilities.length > 0
      ? binding.capabilities
      : [...SABRINA_LOCAL_CAPABILITIES];

  if (target === "remote") {
    return {
      status: "attention",
      target,
      transport: target,
      profile: config.profile,
      stateDir: config.stateDir,
      bindingId: null,
      summary: "远程连接暂未开放",
      detail: "远程连接稍后开放。",
      commandHint: "openclaw sabrina connect --remote",
      doctorHint: "运行 doctor 检查本机环境；远程能力接入后沿用同一绑定模型。",
      transportLabel,
      capabilities,
      lastCheckedAt: checkedAt,
      lastConnectedAt: null,
    };
  }

  if (binding?.status === "active" && gatewayStatus?.ok) {
    return {
      status: "connected",
      target,
      transport: target,
      profile: config.profile,
      stateDir: config.stateDir,
      bindingId: binding.bindingId,
      summary: `已连接 ${binding.displayName}`,
      detail: `Agent ${binding.agentId} · ${transportLabel}`,
      commandHint: "openclaw sabrina status",
      doctorHint: "如连接异常，请运行 doctor 或重新连接。",
      transportLabel,
      capabilities,
      lastCheckedAt: checkedAt,
      lastConnectedAt: binding.lastConnectedAt ?? checkedAt,
    };
  }

  if (config.enabled || bindingSetupState?.status === "bootstrapping") {
    const isConnecting = bindingSetupState?.status === "bootstrapping";
    return {
      status: isConnecting ? "connecting" : "attention",
      target,
      transport: target,
      profile: config.profile,
      stateDir: config.stateDir,
      bindingId: binding?.bindingId ?? null,
      summary: isConnecting ? "正在连接本机 OpenClaw" : "连接需要处理",
      detail:
        detailError ||
        binding?.note ||
        gatewayStatus?.warnings?.[0] ||
        "网关或浏览器代理还没准备好。",
      commandHint: "openclaw sabrina doctor",
      doctorHint: "优先检查 gateway、agent 和模型同步。",
      transportLabel,
      capabilities,
      lastCheckedAt: checkedAt,
      lastConnectedAt: binding?.lastConnectedAt ?? null,
    };
  }

  return {
    status: "disconnected",
    target,
    transport: target,
    profile: config.profile,
    stateDir: config.stateDir,
    bindingId: null,
    summary: "尚未连接本机 OpenClaw",
    detail: `接入后会自动准备浏览器 agent。当前目标：${transportLabel}`,
    commandHint: "openclaw sabrina connect",
    doctorHint: "如果你已经装好了 OpenClaw，可以直接开始连接或先运行 doctor。",
    transportLabel,
    capabilities,
    lastCheckedAt: checkedAt,
    lastConnectedAt: null,
  };
}

export function createDefaultBindingSetupState(target = "local") {
  return {
    status: target === "remote" ? "degraded" : "idle",
    target,
    title: target === "remote" ? "连接远程龙虾" : "连接本机 OpenClaw",
    description:
      target === "remote"
        ? "远程连接稍后开放。"
        : "接入后可直接复用模型、技能和记忆。",
    note:
      target === "remote"
        ? "先完成本机连接即可。"
        : "浏览器会继续保持独立可用。",
    primaryActionLabel: target === "remote" ? undefined : "开始连接",
    secondaryActionLabel: target === "remote" ? "本机优先" : "远程连接稍后开放",
    steps: [
      {
        id: "install-bridge",
        title: "检查龙虾环境",
        description: "确认 OpenClaw 可用。",
        status: "pending",
      },
      {
        id: "ensure-agent",
        title: "准备浏览器代理",
        description: "准备浏览器专用 agent。",
        status: "pending",
      },
      {
        id: "load-skills",
        title: "读取技能能力",
        description: "同步当前可用技能。",
        status: "pending",
      },
      {
        id: "pair-browser",
        title: "授权 Sabrina 连接",
        description: "确认 Sabrina 已接入。",
        status: "pending",
      },
    ],
  };
}

export function createDefaultOpenClawState() {
  return {
    selectedTarget: "local",
    connectionConfig: createDefaultConnectionConfig("local"),
    connectionState: createConnectionState({
      target: "local",
      connectionConfig: createDefaultConnectionConfig("local"),
    }),
    binding: null,
    bindingSetupState: createDefaultBindingSetupState("local"),
    modelState: null,
    skillCatalog: null,
    gatewayStatus: null,
    deviceStatus: null,
    pairingStatus: null,
    lastRefreshedAt: null,
    lastError: "",
  };
}
