import {
  getOpenClawConfig,
  invalidateConfigCache,
} from "./OpenClawConfigCache.mjs";
import { readLocalModelState } from "./ModelStateService.mjs";
import { restartLocalGateway as restartLocalGatewayViaService } from "./OpenClawGatewayService.mjs";
import { ensureSabrinaBrowserAgent } from "./OpenClawAgentBootstrapService.mjs";
import { execOpenClawCommand } from "./OpenClawClient.mjs";

export async function getLocalModelState(agentId = "main") {
  const resolvedAgentId =
    typeof agentId === "string" && agentId.trim()
      ? agentId.trim()
      : (await ensureSabrinaBrowserAgent()).agentId;
  return readLocalModelState(resolvedAgentId);
}

export async function setLocalModel(params) {
  const agentId =
    typeof params?.agentId === "string" && params.agentId.trim()
      ? params.agentId.trim()
      : (await ensureSabrinaBrowserAgent()).agentId;
  const model = typeof params?.model === "string" ? params.model.trim() : "";
  if (!model) {
    throw new Error("缺少模型 id");
  }

  const config = await getOpenClawConfig();
  const agents = config.getConfiguredAgents();
  const agentIndex = agents.findIndex((entry) => entry?.id === agentId);
  if (agentIndex < 0) {
    throw new Error(`未找到 OpenClaw agent: ${agentId}`);
  }

  await execOpenClawCommand(
    ["config", "set", `agents.list[${agentIndex}].model`, JSON.stringify(model), "--strict-json"],
    { timeout: 8000, maxBuffer: 1024 * 256 },
  );

  await invalidateConfigCache();
  await restartLocalGatewayViaService(config);

  return getLocalModelState(agentId);
}
