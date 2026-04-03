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
  simplifyHostLabel,
} from "./OpenClawPresentationService.mjs";
import {
  getGatewayHealthOk,
  getHealthSummary,
  restartLocalGateway as restartLocalGatewayViaService,
} from "./OpenClawGatewayService.mjs";
import { execOpenClawCommand } from "./OpenClawClient.mjs";

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

export async function ensureSabrinaBrowserAgent() {
  if (ensureSabrinaAgentPromise) {
    return ensureSabrinaAgentPromise;
  }

  ensureSabrinaAgentPromise = (async () => {
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
  const ensuredAgent = await ensureSabrinaBrowserAgent();
  const { stateDir, config, agentId, agentRecord } = ensuredAgent;
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
