// OpenClaw adapter owns every interaction with the local control plane:
// binding discovery, agent lifecycle, model policy, and chat routing.
import {
  getOpenClawConfig,
  resolveOpenClawConfigPath,
} from "./OpenClawConfigCache.mjs";
import {
  execGatewayMethodJson,
  execOpenClawJson,
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

let cachedSkillStatusPayload = null;
let cachedSkillStatusExpiresAt = 0;

async function getGatewaySkillStatusSnapshot(options = {}) {
  const force = Boolean(options?.force);
  const now = Date.now();
  if (!force && cachedSkillStatusPayload && now < cachedSkillStatusExpiresAt) {
    return cachedSkillStatusPayload;
  }

  const payload = await execGatewayMethodJson("skills.status");
  cachedSkillStatusPayload = payload;
  cachedSkillStatusExpiresAt = now + 20_000;
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
  const [statusPayload, healthPayload] = await Promise.all([
    execOpenClawJson(["gateway", "status", "--json"]),
    execOpenClawJson(["gateway", "health", "--json"]),
  ]);
  return buildLocalGatewayStatus(statusPayload, healthPayload);
}

export async function getBindingSetupState(params) {
  const target = `${params?.target ?? "local"}`.trim();

  if (target === "remote") {
    return buildBindingSetupState({ target: "remote" });
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
    return buildBindingSetupState({ target: "remote" });
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
