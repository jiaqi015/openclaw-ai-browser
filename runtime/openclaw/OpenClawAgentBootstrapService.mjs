import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  getOpenClawConfig,
  resolveOpenClawStateDir,
} from "./OpenClawConfigCache.mjs";
import { readLocalModelState } from "./ModelStateService.mjs";
import {
  buildLocalBindingRecord,
  buildRemoteBindingRecord,
  simplifyHostLabel,
} from "./OpenClawPresentationService.mjs";
import {
  getGatewayHealthOk,
  getHealthSummary,
  restartLocalGateway as restartLocalGatewayViaService,
} from "./OpenClawGatewayService.mjs";
import { execOpenClawCommand, execOpenClawJson } from "./OpenClawClient.mjs";
import {
  getOpenClawTransportContext,
  getOpenClawRemoteDriver,
  isOpenClawRemoteTransportContext,
  resolveOpenClawStateDirFromContext,
} from "./OpenClawTransportContext.mjs";
import { supportsOpenClawRemoteCliExecution } from "./drivers/OpenClawDriverRegistry.mjs";

export const sabrinaBrowserAgentId = "saburina-browser";
export const sabrinaBrowserAgentName = "Saburina Browser";
let ensureSabrinaAgentPromise = null;

async function readJsonFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function resolveSabrinaBootstrapModel(config) {
  const primaryAgentId = config.getPrimaryAgentId();

  if (primaryAgentId) {
    try {
      const modelState = await readLocalModelState(primaryAgentId);
      if (modelState.desiredModel || modelState.appliedModel) {
        return modelState.desiredModel || modelState.appliedModel;
      }
    } catch {
    }
  }

  const primaryAgent = config.getAgentRecord(primaryAgentId);
  const defaultModel = config.getDefaultModel(primaryAgentId);

  return (
    (primaryAgent ? config.getDefaultModel(primaryAgentId) : defaultModel) ||
    ""
  );
}

export async function listOpenClawAgents() {
  const payload = await execOpenClawJson(["agents", "list", "--json"], {
    timeout: 8000,
    maxBuffer: 1024 * 512,
  });
  return Array.isArray(payload) ? payload : [];
}

function findAgentRecord(agentRecords, agentId) {
  const normalizedAgentId = `${agentId ?? ""}`.trim();
  if (!normalizedAgentId) {
    return null;
  }
  return (
    (Array.isArray(agentRecords) ? agentRecords : []).find(
      (entry) => `${entry?.id ?? ""}`.trim() === normalizedAgentId,
    ) ?? null
  );
}

function inferStateDirFromAgentRecord(agentRecord, fallbackStateDir) {
  const workspace = `${agentRecord?.workspace ?? ""}`.trim();
  if (workspace) {
    if (workspace.endsWith("/workspace")) {
      return workspace.slice(0, -"/workspace".length) || fallbackStateDir;
    }
    if (workspace.includes("/workspaces/")) {
      return workspace.split("/workspaces/")[0] || fallbackStateDir;
    }
  }

  const agentDir = `${agentRecord?.agentDir ?? ""}`.trim();
  if (agentDir.includes("/agents/")) {
    return agentDir.split("/agents/")[0] || fallbackStateDir;
  }

  return fallbackStateDir;
}

function resolveRemoteAgentRecord(agentRecords, context) {
  const explicitAgentId = `${context?.agentId ?? ""}`.trim();
  if (explicitAgentId) {
    const explicitRecord = findAgentRecord(agentRecords, explicitAgentId);
    if (!explicitRecord) {
      throw new Error(`远程 OpenClaw 中未找到 agent: ${explicitAgentId}`);
    }
    return explicitRecord;
  }

  const sabrinaRecord = findAgentRecord(agentRecords, sabrinaBrowserAgentId);
  if (sabrinaRecord) {
    return sabrinaRecord;
  }

  const defaultRecord =
    (Array.isArray(agentRecords) ? agentRecords : []).find((entry) => entry?.isDefault === true) ?? null;
  if (defaultRecord) {
    return defaultRecord;
  }

  const firstRecord = Array.isArray(agentRecords) && agentRecords.length > 0 ? agentRecords[0] : null;
  if (firstRecord) {
    return firstRecord;
  }

  throw new Error("远程 OpenClaw 当前没有可用的 agent。");
}

export async function ensureSabrinaBrowserAgent() {
  if (ensureSabrinaAgentPromise) {
    return ensureSabrinaAgentPromise;
  }

  ensureSabrinaAgentPromise = (async () => {
    const transportContext = getOpenClawTransportContext();
    if (isOpenClawRemoteTransportContext(transportContext)) {
      if (supportsOpenClawRemoteCliExecution(transportContext)) {
        const agentRecords = await listOpenClawAgents();
        const agentRecord = resolveRemoteAgentRecord(agentRecords, transportContext);
        const stateDir = inferStateDirFromAgentRecord(
          agentRecord,
          resolveOpenClawStateDirFromContext(transportContext),
        );

        return {
          agentId: `${agentRecord?.id ?? ""}`.trim() || sabrinaBrowserAgentId,
          agentRecord,
          created: false,
          config: null,
          stateDir,
        };
      }

      const stateDir = resolveOpenClawStateDirFromContext(transportContext);
      const agentId = `${transportContext?.agentId ?? ""}`.trim() || "main";
      return {
        agentId,
        agentRecord: {
          id: agentId,
          name: agentId,
        },
        created: false,
        config: null,
        stateDir,
      };
    }

    const config = await getOpenClawConfig();
    const stateDir = resolveOpenClawStateDir();
    const existingAgent = config.getAgentRecord(sabrinaBrowserAgentId);
    if (existingAgent) {
      return {
        agentId: sabrinaBrowserAgentId,
        agentRecord: existingAgent,
        created: false,
        config,
        stateDir,
      };
    }

    const workspaceDir = path.join(stateDir, "workspaces", sabrinaBrowserAgentId);
    const bootstrapModel = await resolveSabrinaBootstrapModel(config);
    if (!bootstrapModel) {
      throw new Error("当前无法解析 Sabrina Browser 的默认模型。");
    }

    await fs.mkdir(workspaceDir, { recursive: true });
    await execOpenClawCommand(
      [
        "agents",
        "add",
        sabrinaBrowserAgentId,
        "--workspace",
        workspaceDir,
        "--model",
        bootstrapModel,
        "--non-interactive",
        "--json",
      ],
      { timeout: 15000, maxBuffer: 1024 * 512 },
    );

    try {
      await execOpenClawCommand(
        [
          "agents",
          "set-identity",
          "--agent",
          sabrinaBrowserAgentId,
          "--name",
          sabrinaBrowserAgentName,
          "--theme",
          "Minimal",
          "--json",
        ],
        { timeout: 10000, maxBuffer: 1024 * 256 },
      );
    } catch {
    }

    const nextConfig = await getOpenClawConfig(true);
    await restartLocalGatewayViaService(nextConfig);

    return {
      agentId: sabrinaBrowserAgentId,
      agentRecord:
        nextConfig.getAgentRecord(sabrinaBrowserAgentId) ?? {
          id: sabrinaBrowserAgentId,
          name: sabrinaBrowserAgentName,
          workspace: workspaceDir,
          model: bootstrapModel,
        },
      created: true,
      config: nextConfig,
      stateDir,
    };
  })().finally(() => {
    ensureSabrinaAgentPromise = null;
  });

  return ensureSabrinaAgentPromise;
}

export async function buildLocalOpenClawBinding() {
  const transportContext = getOpenClawTransportContext();
  const ensuredAgent = await ensureSabrinaBrowserAgent();
  const { stateDir, config, agentId, agentRecord } = ensuredAgent;

  if (isOpenClawRemoteTransportContext(transportContext)) {
    const gatewayStatus = supportsOpenClawRemoteCliExecution(transportContext)
      ? await execOpenClawJson(["gateway", "status", "--json"], {
          timeout: 12000,
          maxBuffer: 1024 * 1024,
          retries: 0,
        }).catch(() => null)
      : null;
    const gatewayReachable = Boolean(gatewayStatus?.rpc?.ok);
    const remoteLabel =
      `${transportContext.label ?? ""}`.trim() ||
      `${transportContext.sshTarget ?? ""}`.trim() ||
      `${transportContext.relayUrl ?? ""}`.trim() ||
      "remote-openclaw";

    return buildRemoteBindingRecord({
      agentId,
      agentRecord,
      driver: getOpenClawRemoteDriver(transportContext),
      sshTarget: transportContext.sshTarget,
      relayUrl: transportContext.relayUrl,
      displayLabel: remoteLabel,
      gatewayReachable,
      openclawProfile: transportContext.profile,
      openclawStateDir: transportContext.stateDir ?? stateDir,
    });
  }

  const device = await readJsonFile(path.join(stateDir, "identity", "device.json"));
  const deviceAuth = await readJsonFile(
    path.join(stateDir, "identity", "device-auth.json"),
  );
  const hostLabel = simplifyHostLabel(os.hostname());
  const gateway = config.getGatewayEndpoint();
  const gatewayHealth = await getGatewayHealthOk(config);
  const gatewayReachable = Boolean(gatewayHealth.ok);
  const healthSummary = gatewayReachable ? await getHealthSummary() : "";
  return buildLocalBindingRecord({
    device,
    deviceAuth,
    agentId,
    agentRecord,
    gateway,
    gatewayReachable,
    gatewayHealthDetail: gatewayHealth.detail,
    healthSummary,
    hostLabel,
  });
}
