import { setTimeout as sleep } from "node:timers/promises";
import {
  execOpenClawCliCommand,
  execOpenClawCliJson,
} from "./openclaw-cli.mjs";
import { listRelayEnvelopes, sendRelayEnvelope } from "./relay-http.mjs";

function extractAgentText(result = {}) {
  return (Array.isArray(result.payloads) ? result.payloads : [])
    .map((entry) => (typeof entry?.text === "string" ? entry.text.trim() : ""))
    .filter(Boolean)
    .join("\n\n");
}

async function buildOpenClawSnapshot(params = {}, deps) {
  const [gatewayStatus, gatewayHealth, modelsStatus] = await Promise.all([
    deps.execOpenClawCliJson(["gateway", "status", "--json"], {}, params.cliContext),
    deps.execOpenClawCliJson(["gateway", "health", "--json"], {}, params.cliContext),
    deps.execOpenClawCliJson(["models", "status", "--json"], {}, params.cliContext).catch(
      () => null,
    ),
  ]);
  const modelOptions = Array.isArray(modelsStatus?.models)
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

  return {
    agentId: `${params?.agentId ?? "main"}`.trim() || "main",
    gatewayStatus,
    gatewayHealth,
    modelsStatus,
    gateway: {
      ok: Boolean(gatewayHealth?.ok) && Boolean(gatewayStatus?.rpc?.ok),
      serviceStatus: `${gatewayStatus?.service?.runtime?.status ?? "unknown"}`.trim(),
      bindHost: `${gatewayStatus?.gateway?.bindHost ?? ""}`.trim() || null,
      port: Number(gatewayStatus?.gateway?.port ?? 0) || null,
      warnings: Array.isArray(gatewayStatus?.service?.configAudit?.issues)
        ? gatewayStatus.service.configAudit.issues
            .map((issue) => `${issue?.message ?? ""}`.trim())
            .filter(Boolean)
        : [],
    },
    models: {
      defaultModel: `${modelsStatus?.defaultModel ?? ""}`.trim() || null,
      resolvedDefault: `${modelsStatus?.resolvedDefault ?? ""}`.trim() || null,
      count: Array.isArray(modelsStatus?.models) ? modelsStatus.models.length : 0,
    },
    modelOptions,
  };
}

function flattenMissingReasons(missing = {}) {
  return Array.from(
    new Set(
      ["bins", "commands", "env", "files", "packages"]
        .flatMap((key) => (Array.isArray(missing?.[key]) ? missing[key] : []))
        .map((entry) => `${entry ?? ""}`.trim())
        .filter(Boolean),
    ),
  );
}

async function buildOpenClawSkillsStatus(params = {}, deps) {
  try {
    return await deps.execOpenClawCliJson(
      ["gateway", "call", "skills.status", "--json"],
      {},
      params.cliContext,
    );
  } catch {
  }

  const [listPayload, checkPayload] = await Promise.all([
    deps.execOpenClawCliJson(["skills", "list", "--json"], {}, params.cliContext),
    deps.execOpenClawCliJson(["skills", "check", "--json"], {}, params.cliContext),
  ]);
  const missingByName = new Map(
    (Array.isArray(checkPayload?.missingRequirements)
      ? checkPayload.missingRequirements
      : []
    )
      .filter((entry) => typeof entry?.name === "string" && entry.name.trim())
      .map((entry) => [entry.name.trim(), flattenMissingReasons(entry?.missing)]),
  );

  return {
    skills: (Array.isArray(listPayload?.skills) ? listPayload.skills : []).map((entry) => {
      const name = `${entry?.name ?? ""}`.trim();
      return {
        ...entry,
        name,
        missing: {
          ...entry?.missing,
          bins: missingByName.get(name) ?? flattenMissingReasons(entry?.missing),
        },
      };
    }),
  };
}

async function setOpenClawModel(params = {}, deps) {
  const agentId = `${params?.agentId ?? "main"}`.trim() || "main";
  const model = `${params?.model ?? ""}`.trim();
  if (!model) {
    throw new Error("relay rpc openclaw.model.set requires a model.");
  }

  const agents = await deps.execOpenClawCliJson(["agents", "list", "--json"], {}, params.cliContext);
  const agentList = Array.isArray(agents) ? agents : [];
  const agentIndex = agentList.findIndex((entry) => `${entry?.id ?? ""}`.trim() === agentId);
  if (agentIndex < 0) {
    throw new Error(`OpenClaw agent not found: ${agentId}`);
  }

  await deps.execOpenClawCliCommand(
    [
      "config",
      "set",
      `agents.list[${agentIndex}].model`,
      JSON.stringify(model),
      "--strict-json",
    ],
    {
      timeout: 15_000,
    },
    params.cliContext,
  );
  await deps.execOpenClawCliJson(["gateway", "restart", "--json"], {}, params.cliContext).catch(
    () => null,
  );

  return buildOpenClawSnapshot(
    {
      ...params,
      agentId,
    },
    deps,
  );
}

async function runRemoteAgentTurn(params = {}, deps) {
  const agentId = `${params?.agentId ?? "main"}`.trim() || "main";
  const message = `${params?.message ?? ""}`.trim();
  if (!message) {
    throw new Error("relay rpc openclaw.agent.run requires a message.");
  }

  const command = ["agent", "--agent", agentId];
  if (`${params?.sessionId ?? ""}`.trim()) {
    command.push("--session-id", `${params.sessionId}`.trim());
  }
  command.push(
    "--message",
    message,
    "--thinking",
    `${params?.thinking ?? "low"}`.trim() || "low",
    "--json",
  );

  const payload = await deps.execOpenClawCliJson(command, {
    timeout: Number.isFinite(Number(params?.timeoutMs))
      ? Math.max(1_000, Math.trunc(Number(params.timeoutMs)))
      : 5 * 60_000,
  }, params.cliContext);
  const result = payload?.result ?? {};

  return {
    agentId,
    text: extractAgentText(result) || "OpenClaw did not return text.",
    sessionId: result?.meta?.agentMeta?.sessionId ?? null,
    model: result?.meta?.agentMeta?.model ?? null,
    provider: result?.meta?.agentMeta?.provider ?? null,
    durationMs: result?.meta?.durationMs ?? null,
  };
}

export async function handleRelayRpcRequest(request = {}, deps = {}) {
  const method = `${request?.method ?? ""}`.trim();
  const params =
    request?.params && typeof request.params === "object" ? request.params : {};
  const execDeps = {
    execOpenClawCliJson: deps.execOpenClawCliJson ?? execOpenClawCliJson,
    execOpenClawCliCommand: deps.execOpenClawCliCommand ?? execOpenClawCliCommand,
  };

  switch (method) {
    case "rpc.ping":
      return {
        ok: true,
        worker: "openclaw-plugin-sabrina",
        methods: [
          "rpc.ping",
          "openclaw.snapshot",
          "openclaw.skills.status",
          "openclaw.agent.run",
          "openclaw.model.set",
        ],
      };
    case "openclaw.snapshot":
      return buildOpenClawSnapshot(params, execDeps);
    case "openclaw.skills.status":
      return buildOpenClawSkillsStatus(params, execDeps);
    case "openclaw.agent.run":
      return runRemoteAgentTurn(params, execDeps);
    case "openclaw.model.set":
      return setOpenClawModel(params, execDeps);
    default:
      throw new Error(`Unsupported relay rpc method: ${method || "unknown"}`);
  }
}

export async function processRelayWorkerTick(input = {}, deps = {}) {
  const relayUrl = `${input?.relayUrl ?? ""}`.trim();
  const sessionId = `${input?.sessionId ?? ""}`.trim();
  if (!relayUrl || !sessionId) {
    throw new Error("relay worker requires relayUrl and sessionId.");
  }

  const listEnvelopes = deps.listRelayEnvelopes ?? listRelayEnvelopes;
  const sendEnvelope = deps.sendRelayEnvelope ?? sendRelayEnvelope;
  const inbox = await listEnvelopes(relayUrl, sessionId, {
    recipient: "openclaw",
    afterSeq: input?.afterSeq,
  });
  const envelopes = Array.isArray(inbox?.envelopes) ? inbox.envelopes : [];
  let lastSeq = Number.isFinite(Number(input?.afterSeq))
    ? Math.max(0, Math.trunc(Number(input.afterSeq)))
    : 0;
  const responses = [];

  for (const envelope of envelopes) {
    lastSeq = Math.max(lastSeq, Number(envelope?.seq ?? 0) || 0);
    const payload =
      envelope?.payload && typeof envelope.payload === "object" ? envelope.payload : null;
    if (
      envelope?.type !== "rpc.request" ||
      envelope?.to !== "openclaw" ||
      payload?.kind !== "rpc.request" ||
      !`${payload?.requestId ?? ""}`.trim()
    ) {
      continue;
    }

    let responsePayload;
    try {
      const result = await handleRelayRpcRequest(payload, {
        execOpenClawCliJson: deps.execOpenClawCliJson,
        execOpenClawCliCommand: deps.execOpenClawCliCommand,
      });
      responsePayload = {
        kind: "rpc.response",
        requestId: `${payload.requestId}`.trim(),
        ok: true,
        result,
      };
    } catch (error) {
      responsePayload = {
        kind: "rpc.response",
        requestId: `${payload.requestId}`.trim(),
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    const response = await sendEnvelope(relayUrl, sessionId, {
      from: "openclaw",
      to: "browser",
      type: "rpc.response",
      payload: responsePayload,
    });
    responses.push(response?.envelope ?? null);
  }

  return {
    ok: true,
    processedCount: responses.length,
    lastSeq,
    responses,
  };
}

export async function runRelayWorkerLoop(input = {}, deps = {}) {
  const pollIntervalMs = Number.isFinite(Number(input?.pollIntervalMs))
    ? Math.max(100, Math.trunc(Number(input.pollIntervalMs)))
    : 1_000;
  const idleExitMs = Number.isFinite(Number(input?.idleExitMs))
    ? Math.max(0, Math.trunc(Number(input.idleExitMs)))
    : 0;
  let afterSeq = Number.isFinite(Number(input?.afterSeq))
    ? Math.max(0, Math.trunc(Number(input.afterSeq)))
    : 0;
  let processedCount = 0;
  let lastActivityAt = Date.now();

  while (true) {
    const tick = await processRelayWorkerTick(
      {
        relayUrl: input?.relayUrl,
        sessionId: input?.sessionId,
        afterSeq,
      },
      deps,
    );
    afterSeq = tick.lastSeq;
    if (tick.processedCount > 0) {
      processedCount += tick.processedCount;
      lastActivityAt = Date.now();
    }

    if (idleExitMs > 0 && Date.now() - lastActivityAt >= idleExitMs) {
      return {
        ok: true,
        stopped: "idle-timeout",
        afterSeq,
        processedCount,
      };
    }

    await sleep(pollIntervalMs);
  }
}
