import crypto from "node:crypto";
import {
  SABRINA_LOCAL_CAPABILITIES,
  createSabrinaRemoteSessionContract,
  normalizeOpenClawProfile,
  normalizeOpenClawStateDir,
  normalizeSabrinaConnectCode,
  normalizeSabrinaRelayUrl,
  normalizeSabrinaRemoteDriver,
} from "../../packages/sabrina-protocol/index.mjs";
import { getOpenClawTransportLabel } from "./OpenClawTransportContext.mjs";
import {
  buildSabrinaRelayWorkerCommand,
  buildSabrinaRemoteConnectCommand,
} from "../../shared/openclaw-commands.mjs";

import { getCurrentUiLocale, translate } from "../../shared/localization.mjs";

export function normalizeTarget(target) {
  return `${target ?? "local"}`.trim() === "remote" ? "remote" : "local";
}

function normalizeDriver(driver, transport = "local", config = {}) {
  const normalizedRemoteDriver = normalizeSabrinaRemoteDriver(driver);
  if (normalizedRemoteDriver) {
    return normalizedRemoteDriver;
  }
  const normalized = `${driver ?? ""}`.trim();
  if (normalized === "local-cli") {
    return "local-cli";
  }
  if (normalizeTarget(transport) !== "remote") {
    return "local-cli";
  }
  if (normalizeSshTarget(config?.sshTarget)) {
    return "ssh-cli";
  }
  if (normalizeRelayUrl(config?.relayUrl) || normalizeConnectCode(config?.connectCode)) {
    return "relay-paired";
  }
  return "relay-paired";
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

function normalizeLabel(value) {
  const normalized = `${value ?? ""}`.trim();
  return normalized || null;
}

function normalizeRelayUrl(value) {
  return normalizeSabrinaRelayUrl(value);
}

function normalizeConnectCode(value) {
  return normalizeSabrinaConnectCode(value);
}

function normalizeAgentId(value) {
  const normalized = `${value ?? ""}`.trim();
  return normalized || null;
}

function normalizeSavedConnectionStatus(value) {
  const normalized = `${value ?? ""}`.trim();
  if (normalized === "connected" || normalized === "attention") {
    return normalized;
  }
  return "saved";
}

function buildSavedConnectionName(config, input = {}) {
  const explicitName = normalizeLabel(input?.name);
  if (explicitName) {
    return explicitName;
  }

  if (config.transport === "local") {
    return "本机 OpenClaw";
  }

  if (config.label) {
    return config.label;
  }

  if (config.driver === "ssh-cli" && config.sshTarget) {
    return config.label || config.name || config.sshTarget;
  }

  if (config.driver === "relay-paired" && config.relayUrl) {
    return config.relayUrl;
  }

  return "远程 OpenClaw";
}

function buildSavedConnectionId(config, input = {}) {
  const explicitId = `${input?.id ?? ""}`.trim();
  if (explicitId) {
    return explicitId;
  }

  const fingerprint = crypto
    .createHash("sha1")
    .update(
      JSON.stringify({
        transport: config.transport,
        driver: config.driver,
        profile: config.profile,
        stateDir: config.stateDir,
        sshTarget: config.sshTarget,
        sshPort: config.sshPort,
        relayUrl: config.relayUrl,
        label: config.label,
        agentId: config.agentId,
      }),
    )
    .digest("hex")
    .slice(0, 12);

  return `openclaw-${fingerprint}`;
}

export function createSavedConnectionRecord(input = {}) {
  const target = normalizeTarget(input?.transport ?? input?.target ?? "remote");
  const connectionConfig = normalizeConnectionConfig(
    input?.connectionConfig && typeof input.connectionConfig === "object"
      ? {
          ...input.connectionConfig,
          transport: target,
        }
      : {
          ...input,
          transport: target,
        },
    target,
  );
  const name = buildSavedConnectionName(connectionConfig, input);

  return {
    id: buildSavedConnectionId(connectionConfig, input),
    name,
    transport: connectionConfig.transport,
    driver: connectionConfig.driver ?? (target === "remote" ? "relay-paired" : "local-cli"),
    profile: connectionConfig.profile,
    stateDir: connectionConfig.stateDir,
    sshTarget: connectionConfig.sshTarget ?? null,
    sshPort: connectionConfig.sshPort ?? null,
    relayUrl: connectionConfig.relayUrl ?? null,
    connectCode: connectionConfig.driver === "relay-paired"
      ? connectionConfig.connectCode ?? null
      : null,
    label: connectionConfig.label ?? null,
    agentId: connectionConfig.agentId ?? null,
    status: normalizeSavedConnectionStatus(input?.status),
    lastUsedAt:
      typeof input?.lastUsedAt === "string" && input.lastUsedAt.trim()
        ? input.lastUsedAt.trim()
        : null,
    lastConnectedAt:
      typeof input?.lastConnectedAt === "string" && input.lastConnectedAt.trim()
        ? input.lastConnectedAt.trim()
        : null,
  };
}

export function normalizeSavedConnections(values = []) {
  return Array.from(
    new Map(
      (Array.isArray(values) ? values : [])
        .map((entry) => createSavedConnectionRecord(entry))
        .filter((entry) => entry.transport === "remote")
        .map((entry) => [entry.id, entry]),
    ).values(),
  );
}

export function createConnectionConfigFromSavedRecord(savedRecord) {
  return normalizeConnectionConfig(
    {
      enabled: false,
      transport: savedRecord?.transport ?? "remote",
      driver: savedRecord?.driver,
      profile: savedRecord?.profile,
      stateDir: savedRecord?.stateDir,
      sshTarget: savedRecord?.sshTarget,
      sshPort: savedRecord?.sshPort,
      relayUrl: savedRecord?.relayUrl,
      connectCode: savedRecord?.connectCode,
      label: savedRecord?.label ?? savedRecord?.name,
      agentId: savedRecord?.agentId,
    },
    savedRecord?.transport ?? "remote",
  );
}

export function createDefaultConnectionConfig(target = "local") {
  const normalizedTarget = normalizeTarget(target);
  return {
    enabled: false,
    transport: normalizedTarget,
    driver: normalizeDriver(null, normalizedTarget),
    profile: null,
    stateDir: null,
    sshTarget: null,
    sshPort: null,
    relayUrl: null,
    connectCode: null,
    label: null,
    agentId: null,
  };
}

export function normalizeConnectionConfig(rawConfig = {}, fallbackTarget = "local") {
  const transport = normalizeTarget(rawConfig?.transport ?? fallbackTarget);
  return {
    enabled: rawConfig?.enabled === true,
    transport,
    driver: normalizeDriver(rawConfig?.driver, transport, rawConfig),
    profile: normalizeOpenClawProfile(rawConfig?.profile),
    stateDir: normalizeOpenClawStateDir(rawConfig?.stateDir),
    sshTarget: normalizeSshTarget(rawConfig?.sshTarget),
    sshPort: normalizeSshPort(rawConfig?.sshPort),
    relayUrl: normalizeRelayUrl(rawConfig?.relayUrl),
    connectCode: normalizeConnectCode(rawConfig?.connectCode),
    label: normalizeLabel(rawConfig?.label),
    agentId: normalizeAgentId(rawConfig?.agentId),
  };
}

export function createConnectionState(params = {}) {
  const locale = getCurrentUiLocale();
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
  const remoteSessionContract = createSabrinaRemoteSessionContract({
    transport: target,
    driver: config.driver,
    profile: config.profile,
    stateDir: config.stateDir,
    sshTarget: config.sshTarget,
    sshPort: config.sshPort,
    relayUrl: config.relayUrl,
    agentId: binding?.agentId ?? config.agentId,
    features: capabilities,
  });
  const isRemote = target === "remote";
  const targetLabel = translate(
    locale,
    isRemote ? "openclaw.state.target.remote" : "openclaw.state.target.local",
  );
  const remoteConnectHint = buildSabrinaRemoteConnectCommand(config);
  const relayWorkerHint =
    config.driver === "relay-paired" ? buildSabrinaRelayWorkerCommand(config) : "";

  if (binding?.status === "active" && gatewayStatus?.ok) {
    return {
      status: "connected",
      target,
      transport: target,
      profile: config.profile,
      stateDir: config.stateDir,
      bindingId: binding.bindingId,
      summary: translate(locale, "openclaw.state.connectedSummary", {
        name: binding.displayName || targetLabel,
      }),
      detail: `Agent ${binding.agentId} · ${transportLabel}`,
      commandHint: "openclaw sabrina status",
      doctorHint: translate(locale, "openclaw.state.connectedDoctorHint"),
      transportLabel,
      capabilities,
      remoteSessionContract,
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
      summary: isConnecting
        ? translate(locale, "openclaw.state.connectingSummary", {
            target: targetLabel,
          })
        : translate(locale, "openclaw.state.attentionSummary"),
      detail:
        detailError ||
        binding?.note ||
        gatewayStatus?.warnings?.[0] ||
        translate(
          locale,
          isRemote ? "openclaw.state.remoteNotReady" : "openclaw.state.localNotReady",
        ),
      commandHint:
        isRemote && relayWorkerHint
          ? relayWorkerHint
          : isRemote
            ? "openclaw sabrina doctor --target remote"
            : "openclaw sabrina doctor",
      doctorHint: translate(
        locale,
        isRemote && config.driver === "relay-paired"
          ? "openclaw.state.remoteRelayDoctor"
          : isRemote
            ? "openclaw.state.remoteDoctor"
            : "openclaw.state.localDoctor",
      ),
      transportLabel,
      capabilities,
      remoteSessionContract,
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
    summary: translate(locale, "openclaw.state.disconnectedSummary", {
      target: targetLabel,
    }),
    detail: isRemote
      ? config.driver === "relay-paired"
        ? config.relayUrl && config.connectCode
          ? translate(locale, "openclaw.state.remoteDetailWithTarget", {
              target: transportLabel,
            })
          : translate(locale, "openclaw.state.remoteRelayDetailWithoutTarget")
        : config.sshTarget || config.label
          ? translate(locale, "openclaw.state.remoteDetailWithTarget", {
              target: transportLabel,
            })
          : translate(locale, "openclaw.state.remoteDetailWithoutTarget")
      : translate(locale, "openclaw.state.localDetail", {
          target: transportLabel,
        }),
    commandHint: isRemote
      ? remoteConnectHint
      : "openclaw sabrina connect",
    doctorHint: translate(
      locale,
      isRemote
        ? "openclaw.state.remoteDoctorDisconnected"
        : "openclaw.state.localDoctorDisconnected",
    ),
    transportLabel,
    capabilities,
    remoteSessionContract,
    lastCheckedAt: checkedAt,
    lastConnectedAt: null,
  };
}

export function createDefaultBindingSetupState(target = "local") {
  const normalizedTarget = normalizeTarget(target);
  const locale = getCurrentUiLocale();
  return {
    status: normalizedTarget === "remote" ? "degraded" : "idle",
    target: normalizedTarget,
    title:
      normalizedTarget === "remote"
        ? translate(locale, "binding.default.remote.title")
        : translate(locale, "binding.default.local.title"),
    description:
      normalizedTarget === "remote"
        ? translate(locale, "binding.default.remote.description")
        : translate(locale, "binding.default.local.description"),
    note:
      normalizedTarget === "remote"
        ? translate(locale, "binding.default.remote.note")
        : translate(locale, "binding.default.local.note"),
    primaryActionLabel:
      normalizedTarget === "remote"
        ? undefined
        : translate(locale, "binding.default.local.primary"),
    secondaryActionLabel:
      normalizedTarget === "remote"
        ? translate(locale, "binding.default.remote.secondary")
        : translate(locale, "binding.default.local.secondary"),
    steps: [
      {
        id: "install-bridge",
        title: translate(locale, "binding.step.install.title"),
        description: translate(locale, "binding.step.install.description"),
        status: "pending",
      },
      {
        id: "ensure-agent",
        title: translate(locale, "binding.step.ensure.title"),
        description: translate(locale, "binding.step.ensure.description"),
        status: "pending",
      },
      {
        id: "load-skills",
        title: translate(locale, "binding.step.load.title"),
        description: translate(locale, "binding.step.load.description"),
        status: "pending",
      },
      {
        id: "pair-browser",
        title: translate(locale, "binding.step.pair.title"),
        description: translate(locale, "binding.step.pair.description"),
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
    savedConnections: [],
    activeConnectionId: null,
    lastRefreshedAt: null,
    lastError: "",
  };
}
