// OpenClaw adapter owns every interaction with the local control plane:
// binding discovery, agent lifecycle, model policy, and chat routing.
import {
  getOpenClawConfig,
  resolveOpenClawConfigPath,
} from "./OpenClawConfigCache.mjs";
import {
  execGatewayMethodJson,
  execOpenClawJson,
  probeOpenClawTransport,
} from "./OpenClawClient.mjs";
import {
  flattenMissingReasons,
  normalizeSkillMetadata,
  toCatalogSkillEntry,
  buildSkillCatalogSummary,
  sortSkillCatalogEntries,
} from "./SkillCatalogService.mjs";
import {
  buildBindingSetupState,
  pathExists as bindingPathExists,
} from "./BindingSetupService.mjs";
import {
  buildLocalGatewayStatus,
} from "./OpenClawStatusService.mjs";
import {
  getOpenClawTransportContext,
  getOpenClawRemoteDriver,
  getOpenClawRemoteTargetRef,
  getOpenClawTransportLabel,
} from "./OpenClawTransportContext.mjs";
import {
  getGatewayHealthOk,
  recoverLocalGateway as recoverLocalGatewayViaService,
  restartLocalGateway as restartLocalGatewayViaService,
  ensureChatCompletionsEndpoint as ensureChatCompletionsEndpointViaService,
  runGatewayChatCompletion as runGatewayChatCompletionViaService,
} from "./OpenClawGatewayService.mjs";
import {
  runLocalAgentTurn as runLocalAgentTurnViaService,
  runLocalSkillTurn as runLocalSkillTurnViaService,
} from "./OpenClawExecutionService.mjs";
import {
  buildLocalOpenClawBinding,
  ensureSabrinaBrowserAgent,
  sabrinaBrowserAgentId,
  sabrinaBrowserAgentName,
} from "./OpenClawAgentBootstrapService.mjs";
import {
  getLocalModelState,
  setLocalModel,
} from "./OpenClawModelPolicyService.mjs";
import {
  approveLocalDeviceRequest,
  approveLocalPairingRequest,
  getLocalDeviceStatus,
  getLocalPairingStatus,
} from "./OpenClawPairingService.mjs";
import { readPrimaryAgentWorkspaceMemory } from "./OpenClawWorkspaceMemoryService.mjs";
import { supportsOpenClawRemoteCliExecution } from "./drivers/OpenClawDriverRegistry.mjs";
import { invokeSabrinaRelayRpc } from "./relay/SabrinaRelayRpcService.mjs";

export {
  buildLocalOpenClawBinding,
  ensureSabrinaBrowserAgent,
  sabrinaBrowserAgentId,
  sabrinaBrowserAgentName,
} from "./OpenClawAgentBootstrapService.mjs";
export {
  getLocalModelState,
  setLocalModel,
} from "./OpenClawModelPolicyService.mjs";
export {
  approveLocalDeviceRequest,
  approveLocalPairingRequest,
  getLocalDeviceStatus,
  getLocalPairingStatus,
} from "./OpenClawPairingService.mjs";
export { readPrimaryAgentWorkspaceMemory } from "./OpenClawWorkspaceMemoryService.mjs";

const cachedSkillStatusByTransport = new Map();

function isRelayRemoteContext(context = getOpenClawTransportContext()) {
  return (
    getOpenClawRemoteDriver(context) === "relay-paired" &&
    !supportsOpenClawRemoteCliExecution(context)
  );
}

function getSkillStatusCacheKey() {
  const context = getOpenClawTransportContext();
  const transportLabel = getOpenClawTransportLabel(context);
  return JSON.stringify({
    transport: context?.transport ?? "local",
    driver: context?.driver ?? "local-cli",
    profile: context?.profile ?? null,
    stateDir: context?.stateDir ?? null,
    sshTarget: context?.sshTarget ?? null,
    sshPort: context?.sshPort ?? null,
    connectCode: context?.connectCode ?? null,
    transportLabel,
  });
}

async function getGatewaySkillStatusSnapshot(options = {}) {
  const force = Boolean(options?.force);
  const now = Date.now();
  const cacheKey = getSkillStatusCacheKey();
  const cached = cachedSkillStatusByTransport.get(cacheKey);
  if (!force && cached?.payload && now < cached.expiresAt) {
    return cached.payload;
  }

  const context = getOpenClawTransportContext();
  const payload = isRelayRemoteContext(context)
    ? (
        await invokeSabrinaRelayRpc({
          relayUrl: context.relayUrl,
          connectCode: context.connectCode,
          method: "openclaw.skills.status",
          params: {
            agentId: context.agentId,
          },
          timeoutMs: 6_000,
        })
      ).result
    : await execGatewayMethodJson("skills.status");
  cachedSkillStatusByTransport.set(cacheKey, {
    payload,
    expiresAt: now + 20_000,
  });
  return payload;
}

export function getOpenClawSessionId(tabId) {
  return tabId ? `sabrina-tab:${tabId}` : "sabrina-browser";
}

export async function restartLocalGateway(config) {
  return restartLocalGatewayViaService(config);
}

export async function runGatewayChatCompletion(params) {
  return runGatewayChatCompletionViaService(params, {
    defaultAgentId: sabrinaBrowserAgentId,
  });
}

export async function getLocalSkillCatalog() {
  try {
    const statusPayload = await getGatewaySkillStatusSnapshot();
    const skills = sortSkillCatalogEntries((Array.isArray(statusPayload?.skills) ? statusPayload.skills : [])
      .map((entry) => toCatalogSkillEntry(entry))
      .filter((entry) => entry.name));

    return {
      summary: buildSkillCatalogSummary(skills),
      skills,
    };
  } catch {
  }

  const [listPayload, checkPayload] = await Promise.all([
    execOpenClawJson(["skills", "list", "--json"]),
    execOpenClawJson(["skills", "check", "--json"]),
  ]);
  const missingByName = new Map(
    (Array.isArray(checkPayload?.missingRequirements) ? checkPayload.missingRequirements : [])
      .filter((entry) => typeof entry?.name === "string" && entry.name.trim())
      .map((entry) => [entry.name.trim(), flattenMissingReasons(entry?.missing)]),
  );

  const skills = sortSkillCatalogEntries((Array.isArray(listPayload?.skills) ? listPayload.skills : [])
    .filter((entry) => typeof entry?.name === "string" && entry.name.trim())
    .map((entry) => {
      const name = entry.name.trim();
      const missingReasons = missingByName.get(name) ?? flattenMissingReasons(entry?.missing);

      return toCatalogSkillEntry({
        ...entry,
        name,
        missing: {
          ...entry?.missing,
          bins: missingReasons,
        },
      });
    }));

  return {
    summary: buildSkillCatalogSummary(skills),
    skills,
  };
}

export async function getLocalSkillDetail(skillName) {
  const normalizedSkillName = `${skillName ?? ""}`.trim();
  if (!normalizedSkillName) {
    throw new Error("缺少 skill 名称");
  }

  try {
    for (const force of [false, true]) {
      const statusPayload = await getGatewaySkillStatusSnapshot({ force });
      const rawSkill = (Array.isArray(statusPayload?.skills) ? statusPayload.skills : []).find(
        (entry) =>
          `${entry?.name ?? ""}`.trim() === normalizedSkillName ||
          `${entry?.skillKey ?? ""}`.trim() === normalizedSkillName,
      );
      if (rawSkill) {
        return normalizeSkillMetadata(rawSkill);
      }
    }
  } catch {
  }

  const payload = await execOpenClawJson(["skills", "info", normalizedSkillName, "--json"]);
  const normalized = normalizeSkillMetadata(payload);
  if (!normalized.name) {
    throw new Error(`未找到 OpenClaw skill: ${normalizedSkillName}`);
  }

  return normalized;
}

export async function getLocalGatewayStatus() {
  const context = getOpenClawTransportContext();
  if (isRelayRemoteContext(context)) {
    const snapshot = (
      await invokeSabrinaRelayRpc({
        relayUrl: context.relayUrl,
        connectCode: context.connectCode,
        method: "openclaw.snapshot",
        params: {
          agentId: context.agentId,
        },
        timeoutMs: 6_000,
      })
    ).result;
    return buildLocalGatewayStatus(snapshot?.gatewayStatus, snapshot?.gatewayHealth);
  }

  const [statusPayload, healthPayload] = await Promise.all([
    execOpenClawJson(["gateway", "status", "--json"]),
    execOpenClawJson(["gateway", "health", "--json"]),
  ]);
  return buildLocalGatewayStatus(statusPayload, healthPayload);
}

export async function getBindingSetupState(params) {
  const target = `${params?.target ?? "local"}`.trim();

  if (target === "remote") {
    const context = getOpenClawTransportContext();
    const transportLabel = getOpenClawTransportLabel(context);
    const hasRemoteTarget = Boolean(getOpenClawRemoteTargetRef(context));
    if (!hasRemoteTarget) {
      return buildBindingSetupState({
        target: "remote",
        statusOverride: "degraded",
        transportLabel,
        note: "请先提供远程控制面目标。",
      });
    }

    try {
      const probe = await probeOpenClawTransport();
      if (!probe.ok) {
        return buildBindingSetupState({
          target: "remote",
          statusOverride: "degraded",
          configExists: hasRemoteTarget,
          transportLabel,
          sshTarget: context.sshTarget,
          note: probe.detail || `当前无法访问远程控制面 ${transportLabel}。`,
        });
      }

      const ensuredAgent = await ensureSabrinaBrowserAgent();
      const gatewayStatus = await getLocalGatewayStatus().catch(() => null);
      const skillCatalog = await getLocalSkillCatalog().catch(() => null);

      return buildBindingSetupState({
        target: "remote",
        configExists: hasRemoteTarget,
        hasAgent: Boolean(ensuredAgent?.agentId),
        gatewayReachable: Boolean(gatewayStatus?.ok),
        hasSkillCatalog: Boolean(skillCatalog),
        skillCount: skillCatalog?.summary?.ready ?? skillCatalog?.summary?.eligible ?? 0,
        transportLabel,
        sshTarget: context.sshTarget,
        note: Boolean(gatewayStatus?.ok)
          ? `当前会复用远程 OpenClaw 的 agent、模型和技能。`
          : `当前可以访问远程控制面 ${transportLabel}，但还没确认远程网关就绪。`,
      });
    } catch (error) {
      return buildBindingSetupState({
        target: "remote",
        statusOverride: "degraded",
        transportLabel,
        sshTarget: context.sshTarget,
        note: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    const config = await getOpenClawConfig();
    const configPath = resolveOpenClawConfigPath();
    const configExists = await bindingPathExists(configPath);
    const agentRecord = config.getAgentRecord(sabrinaBrowserAgentId);
    const gatewayHealth = await getGatewayHealthOk(config);
    const gatewayReachable = Boolean(gatewayHealth.ok);

    let skillCatalog = null;
    try {
      skillCatalog = await getLocalSkillCatalog();
    } catch {
      skillCatalog = null;
    }

    return buildBindingSetupState({
      target: "local",
      configExists,
      hasAgent: Boolean(agentRecord),
      gatewayReachable,
      hasSkillCatalog: Boolean(skillCatalog),
      skillCount: skillCatalog?.summary?.eligible ?? 0,
      note: gatewayReachable
        ? "当前会直接复用本机龙虾的代理、工作区、记忆和技能。"
        : `如果网关当前不可用，浏览器仍可正常浏览网页，只是 AI 能力不可用。${gatewayHealth.detail ? `（${gatewayHealth.detail}）` : ""}`,
    });
  } catch (error) {
    return buildBindingSetupState({
      target: "local",
      statusOverride: "degraded",
      note: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function beginBindingSetup(params) {
  const target = `${params?.target ?? "local"}`.trim();

  if (target === "remote") {
    const context = getOpenClawTransportContext();
    const transportLabel = getOpenClawTransportLabel(context);
    const hasRemoteTarget = Boolean(getOpenClawRemoteTargetRef(context));
    if (!hasRemoteTarget) {
      return buildBindingSetupState({
        target: "remote",
        statusOverride: "degraded",
        transportLabel,
        note: "请先提供远程控制面目标。",
      });
    }

    try {
      const probe = await probeOpenClawTransport();
      if (!probe.ok) {
        return buildBindingSetupState({
          target: "remote",
          statusOverride: "degraded",
          configExists: hasRemoteTarget,
          transportLabel,
          sshTarget: context.sshTarget,
          note: probe.detail || `当前无法访问远程控制面 ${transportLabel}。`,
        });
      }

      const ensuredAgent = await ensureSabrinaBrowserAgent();
      const gatewayStatus = await getLocalGatewayStatus().catch(() => null);
      const skillCatalog = await getLocalSkillCatalog().catch(() => null);
      await buildLocalOpenClawBinding().catch(() => null);

      return buildBindingSetupState({
        target: "remote",
        configExists: hasRemoteTarget,
        hasAgent: Boolean(ensuredAgent?.agentId),
        gatewayReachable: Boolean(gatewayStatus?.ok),
        hasSkillCatalog: Boolean(skillCatalog),
        skillCount: skillCatalog?.summary?.ready ?? skillCatalog?.summary?.eligible ?? 0,
        transportLabel,
        sshTarget: context.sshTarget,
        note: Boolean(gatewayStatus?.ok)
          ? `已验证远程控制面 ${transportLabel} 可用。`
          : `已连接到远程控制面 ${transportLabel}，但远程网关还未就绪。`,
      });
    } catch (error) {
      return buildBindingSetupState({
        target: "remote",
        statusOverride: "degraded",
        transportLabel,
        sshTarget: context.sshTarget,
        note: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    const config = await getOpenClawConfig();
    const ensuredAgent = await ensureSabrinaBrowserAgent();
    const nextConfig = ensuredAgent?.config ?? config;
    const recovery = await recoverLocalGatewayViaService(nextConfig);
    const skillCatalog = await getLocalSkillCatalog().catch(() => null);

    if (!recovery.ok) {
      return buildBindingSetupState({
        target: "local",
        configExists: true,
        hasAgent: true,
        hasSkillCatalog: Boolean(skillCatalog),
        skillCount: skillCatalog?.summary?.eligible ?? 0,
        gatewayReachable: false,
        statusOverride: "degraded",
        note:
          recovery.note ||
          "未能恢复本机龙虾网关。浏览器仍可浏览网页，但 AI 能力暂不可用。",
      });
    }

    await ensureChatCompletionsEndpointViaService();
    await buildLocalOpenClawBinding();

    return await getBindingSetupState();
  } catch (error) {
    return buildBindingSetupState({
      target: "local",
      statusOverride: "degraded",
      note: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function runLocalSkillTurn(params) {
  return runLocalSkillTurnViaService(params, {
    getLocalSkillDetail,
    resolveDefaultAgentId: async () => (await ensureSabrinaBrowserAgent()).agentId,
  });
}

export async function runLocalAgentTurn(params) {
  return runLocalAgentTurnViaService(params, {
    resolveDefaultAgentId: async () => (await ensureSabrinaBrowserAgent()).agentId,
  });
}
