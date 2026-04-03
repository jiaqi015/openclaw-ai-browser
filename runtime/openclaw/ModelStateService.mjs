import { getOpenClawConfig } from "./OpenClawConfigCache.mjs";
import { execOpenClawJson } from "./OpenClawClient.mjs";

function getModelDisplayLabel(modelId, aliasByModelId) {
  const alias = aliasByModelId.get(modelId);
  if (alias) {
    return alias;
  }

  const slashIndex = modelId.indexOf("/");
  if (slashIndex >= 0 && slashIndex < modelId.length - 1) {
    return modelId.slice(slashIndex + 1);
  }

  return modelId;
}

function resolveConfiguredAgentModel(agentRecord) {
  if (typeof agentRecord?.model === "string" && agentRecord.model.trim()) {
    return agentRecord.model.trim();
  }

  if (
    agentRecord?.model &&
    typeof agentRecord.model === "object" &&
    typeof agentRecord.model.primary === "string" &&
    agentRecord.model.primary.trim()
  ) {
    return agentRecord.model.primary.trim();
  }

  return "";
}

export async function readLocalModelState(agentId) {
  const resolvedAgentId = `${agentId ?? ""}`.trim();
  if (!resolvedAgentId) {
    throw new Error("缺少 OpenClaw agent id");
  }

  const config = await getOpenClawConfig();
  const configuredAgent = config
    .getConfiguredAgents()
    .find((entry) => entry?.id === resolvedAgentId);
  const desiredModel = resolveConfiguredAgentModel(configuredAgent) || null;

  const [listPayload, statusPayload] = await Promise.all([
    execOpenClawJson(
      ["models", "--agent", resolvedAgentId, "list", "--all", "--json"],
      { timeout: 5000, maxBuffer: 1024 * 512 },
    ),
    execOpenClawJson(
      ["models", "--agent", resolvedAgentId, "status", "--json"],
      { timeout: 5000, maxBuffer: 1024 * 512 },
    ),
  ]);

  const models = Array.isArray(listPayload?.models) ? listPayload.models : [];
  const aliases = statusPayload?.aliases ?? {};
  const allowedModels = Array.isArray(statusPayload?.allowed)
    ? statusPayload.allowed.filter(
        (modelId) => typeof modelId === "string" && modelId.trim(),
      )
    : [];
  const aliasByModelId = new Map(
    Object.entries(aliases)
      .filter(
        ([alias, modelId]) =>
          typeof alias === "string" &&
          alias.trim() &&
          typeof modelId === "string" &&
          modelId.trim(),
      )
      .map(([alias, modelId]) => [modelId, alias.trim()]),
  );

  const appliedModel =
    statusPayload?.resolvedDefault ||
    statusPayload?.defaultModel ||
    models.find((model) => Array.isArray(model?.tags) && model.tags.includes("default"))?.key ||
    desiredModel ||
    models[0]?.key ||
    null;

  const allowedSet = new Set(allowedModels);
  const displayModels = allowedSet.size
    ? models.filter((model) => allowedSet.has(model.key))
    : models.filter((model) => model.key === appliedModel || model.key === desiredModel);
  const finalModels = displayModels.some(
    (model) => model.key === appliedModel || model.key === desiredModel,
  )
    ? displayModels
    : [
        ...displayModels,
        ...models.filter((model) => model.key === appliedModel || model.key === desiredModel),
      ];

  return {
    agentId: resolvedAgentId,
    desiredModel,
    appliedModel,
    models: finalModels.map((model) => ({
      id: model.key,
      label: getModelDisplayLabel(model.key, aliasByModelId),
      desc: model.available
        ? `${model.key} · ${Math.round((model.contextWindow ?? 0) / 1024)}k ctx`
        : `${model.key} · unavailable`,
      available: Boolean(model.available) && !model.missing,
    })),
  };
}
