import { invalidateConfigCache } from "./OpenClawConfigCache.mjs";
import { readLocalModelState } from "./ModelStateService.mjs";
import { restartLocalGateway as restartLocalGatewayViaService } from "./OpenClawGatewayService.mjs";
import { ensureSabrinaBrowserAgent } from "./OpenClawAgentBootstrapService.mjs";
import { execOpenClawCommand, execOpenClawJson } from "./OpenClawClient.mjs";
import {
  getOpenClawRemoteDriver,
  getOpenClawTransportContext,
} from "./OpenClawTransportContext.mjs";
import { supportsOpenClawRemoteCliExecution } from "./drivers/OpenClawDriverRegistry.mjs";
import { invokeSabrinaRelayRpc } from "./relay/SabrinaRelayRpcService.mjs";

function isRelayRemoteContext(context = getOpenClawTransportContext()) {
  return (
    getOpenClawRemoteDriver(context) === "relay-paired" &&
    !supportsOpenClawRemoteCliExecution(context)
  );
}

function buildRelayModelState(snapshot = {}, fallbackAgentId = "main") {
  const modelsStatus = snapshot?.modelsStatus ?? {};
  const models = Array.isArray(snapshot?.modelOptions)
    ? snapshot.modelOptions
    : Array.isArray(modelsStatus?.models)
      ? modelsStatus.models
          .map((entry) => {
            const id =
              `${entry?.id ?? entry?.model ?? entry?.name ?? ""}`.trim() || null;
            if (!id) {
              return null;
            }
            return {
              id,
              label:
                `${entry?.label ?? entry?.alias ?? entry?.displayName ?? id}`.trim() || id,
              desc:
                `${entry?.desc ?? entry?.provider ?? entry?.source ?? ""}`.trim() || id,
              available: entry?.available !== false,
            };
          })
          .filter(Boolean)
      : [];
  const desiredModel =
    `${modelsStatus?.defaultModel ?? snapshot?.models?.defaultModel ?? ""}`.trim() || null;
  const appliedModel =
    `${modelsStatus?.resolvedDefault ?? snapshot?.models?.resolvedDefault ?? ""}`.trim() ||
    desiredModel ||
    null;

  return {
    agentId: `${snapshot?.agentId ?? fallbackAgentId ?? "main"}`.trim() || "main",
    desiredModel,
    appliedModel,
    models,
  };
}

export async function getLocalModelState(agentId) {
  const context = getOpenClawTransportContext();
  const resolvedAgentId =
    typeof agentId === "string" && agentId.trim()
      ? agentId.trim()
      : context.agentId || (await ensureSabrinaBrowserAgent()).agentId;
  if (isRelayRemoteContext(context)) {
    const snapshot = (
      await invokeSabrinaRelayRpc({
        relayUrl: context.relayUrl,
        connectCode: context.connectCode,
        method: "openclaw.snapshot",
        params: {
          agentId: resolvedAgentId,
        },
        timeoutMs: 6_000,
      })
    ).result;
    return buildRelayModelState(snapshot, resolvedAgentId);
  }
  return readLocalModelState(resolvedAgentId);
}

export async function setLocalModel(params) {
  const context = getOpenClawTransportContext();
  const agentId =
    typeof params?.agentId === "string" && params.agentId.trim()
      ? params.agentId.trim()
      : context.agentId || (await ensureSabrinaBrowserAgent()).agentId;
  const model = typeof params?.model === "string" ? params.model.trim() : "";
  if (!model) {
    throw new Error("缺少模型 id");
  }
  if (isRelayRemoteContext(context)) {
    const snapshot = (
      await invokeSabrinaRelayRpc({
        relayUrl: context.relayUrl,
        connectCode: context.connectCode,
        method: "openclaw.model.set",
        params: {
          agentId,
          model,
        },
        timeoutMs: 15_000,
      })
    ).result;
    return buildRelayModelState(snapshot, agentId);
  }

  const agents = await execOpenClawJson(["agents", "list", "--json"], {
    timeout: 5000,
    maxBuffer: 1024 * 512,
  });
  const agentList = Array.isArray(agents) ? agents : [];
  const agentIndex = agentList.findIndex((entry) => `${entry?.id ?? ""}`.trim() === agentId);
  if (agentIndex < 0) {
    throw new Error(`未找到 OpenClaw agent: ${agentId}`);
  }

  await execOpenClawCommand(
    ["config", "set", `agents.list[${agentIndex}].model`, JSON.stringify(model), "--strict-json"],
    { timeout: 8000, maxBuffer: 1024 * 256 },
  );

  await invalidateConfigCache();
  await restartLocalGatewayViaService();

  return getLocalModelState(agentId);
}
