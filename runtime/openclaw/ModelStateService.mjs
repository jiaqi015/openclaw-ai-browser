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

function buildModelDescription(model, fallbackLabel = model?.key ?? "") {
  if (model?.available) {
    const contextWindow = Number(model?.contextWindow ?? 0);
    if (Number.isFinite(contextWindow) && contextWindow > 0) {
      return `${fallbackLabel} · ${Math.round(contextWindow / 1024)}k ctx`;
    }
  }
  return model?.available ? fallbackLabel : `${fallbackLabel} · unavailable`;
}

function buildFallbackModelDescription(modelId, appliedModel, desiredModel) {
  const facts = [];
  if (modelId === appliedModel) {
    facts.push("active");
  }
  if (modelId === desiredModel && desiredModel !== appliedModel) {
    facts.push("configured");
  }
  return facts.length > 0 ? `${modelId} · ${facts.join(", ")}` : modelId;
}

function buildFallbackModels({
  allowedModels,
  appliedModel,
  desiredModel,
  aliasByModelId,
}) {
  const fallbackIds = [];
  const pushId = (modelId) => {
    const normalizedModelId = `${modelId ?? ""}`.trim();
    if (!normalizedModelId || fallbackIds.includes(normalizedModelId)) {
      return;
    }
    fallbackIds.push(normalizedModelId);
  };

  for (const modelId of Array.isArray(allowedModels) ? allowedModels : []) {
    pushId(modelId);
  }
  pushId(appliedModel);
  pushId(desiredModel);

  return fallbackIds.map((modelId) => ({
    id: modelId,
    label: getModelDisplayLabel(modelId, aliasByModelId),
    desc: buildFallbackModelDescription(modelId, appliedModel, desiredModel),
    available: true,
  }));
}

export function buildLocalModelState({
  agentId,
  agentRecords,
  listPayload,
  statusPayload,
}) {
  const resolvedAgentId = `${agentId ?? ""}`.trim();
  if (!resolvedAgentId) {
    throw new Error("缺少 OpenClaw agent id");
  }

  if (!statusPayload && !listPayload) {
    throw new Error(`读取 OpenClaw 模型状态失败 (agent: ${resolvedAgentId}): 缺少模型状态载荷`);
  }

  const configuredAgent = (Array.isArray(agentRecords) ? agentRecords : []).find(
    (entry) => `${entry?.id ?? ""}`.trim() === resolvedAgentId,
  );
  const desiredModel =
    typeof configuredAgent?.model === "string" && configuredAgent.model.trim()
      ? configuredAgent.model.trim()
      : null;

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

  const listModels = Array.isArray(listPayload?.models) ? listPayload.models : [];
  const appliedModel =
    statusPayload?.resolvedDefault ||
    statusPayload?.defaultModel ||
    listModels.find((model) => Array.isArray(model?.tags) && model.tags.includes("default"))?.key ||
    desiredModel ||
    listModels[0]?.key ||
    allowedModels[0] ||
    null;

  let finalModels = [];
  if (listModels.length > 0) {
    const allowedSet = new Set(allowedModels);
    const displayModels = allowedSet.size
      ? listModels.filter((model) => allowedSet.has(model.key))
      : listModels.filter((model) => model.key === appliedModel || model.key === desiredModel);
    const prioritizedModels = displayModels.some(
      (model) => model.key === appliedModel || model.key === desiredModel,
    )
      ? displayModels
      : [
          ...displayModels,
          ...listModels.filter((model) => model.key === appliedModel || model.key === desiredModel),
        ];
    const seenIds = new Set();
    finalModels = prioritizedModels
      .filter((model) => {
        const modelId = `${model?.key ?? ""}`.trim();
        if (!modelId || seenIds.has(modelId)) {
          return false;
        }
        seenIds.add(modelId);
        return true;
      })
      .map((model) => ({
        id: model.key,
        label: getModelDisplayLabel(model.key, aliasByModelId),
        desc: buildModelDescription(model, model.key),
        available: Boolean(model.available) && !model.missing,
      }));
  } else {
    finalModels = buildFallbackModels({
      allowedModels,
      appliedModel,
      desiredModel,
      aliasByModelId,
    });
  }

  return {
    agentId: resolvedAgentId,
    desiredModel,
    appliedModel,
    models: finalModels,
  };
}

export async function readLocalModelState(agentId, options = {}) {
  const resolvedAgentId = `${agentId ?? ""}`.trim();
  if (!resolvedAgentId) {
    throw new Error("缺少 OpenClaw agent id");
  }

  const execJson = options?.execJson ?? execOpenClawJson;
  const [agentRecordsResult, listPayloadResult, statusPayloadResult] = await Promise.allSettled([
    execJson(
      ["agents", "list", "--json"],
      { timeout: 8000, maxBuffer: 1024 * 512, retries: 0 },
    ),
    execJson(
      ["models", "--agent", resolvedAgentId, "list", "--all", "--json"],
      { timeout: 3500, maxBuffer: 1024 * 1024 * 8, retries: 0 },
    ),
    execJson(
      ["models", "--agent", resolvedAgentId, "status", "--json"],
      { timeout: 8000, maxBuffer: 1024 * 1024, retries: 0 },
    ),
  ]);

  const agentRecords =
    agentRecordsResult.status === "fulfilled" ? agentRecordsResult.value : [];
  const listPayload =
    listPayloadResult.status === "fulfilled" ? listPayloadResult.value : null;
  const statusPayload =
    statusPayloadResult.status === "fulfilled" ? statusPayloadResult.value : null;

  if (!statusPayload && !listPayload) {
    const errorMessages = [
      agentRecordsResult,
      listPayloadResult,
      statusPayloadResult,
    ]
      .filter((result) => result.status === "rejected")
      .map((result) =>
        result.reason instanceof Error ? result.reason.message : String(result.reason),
      );
    throw new Error(
      `读取 OpenClaw 模型状态失败 (agent: ${resolvedAgentId}): ${errorMessages.join(" | ") || "未知错误"}`,
    );
  }

  return buildLocalModelState({
    agentId: resolvedAgentId,
    agentRecords,
    listPayload,
    statusPayload,
  });
}
