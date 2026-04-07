import {
  approveLocalDeviceRequest,
  approveLocalPairingRequest,
  beginBindingSetup,
  getLocalModelState,
  setLocalModel,
} from "./OpenClawManager.mjs";
import {
  execOpenClawJson,
  probeOpenClawTransport,
} from "./OpenClawClient.mjs";
import {
  patchOpenClawState,
  refreshOpenClawState,
  removeOpenClawSavedConnection,
  saveOpenClawSavedConnection,
  selectOpenClawSavedConnection,
  serializeOpenClawState,
  setOpenClawSelectedTarget,
} from "./OpenClawStateStore.mjs";
import {
  createSavedConnectionRecord,
  createDefaultBindingSetupState,
  normalizeConnectionConfig,
} from "./OpenClawStateModel.mjs";
import { buildOpenClawDoctorReport } from "./OpenClawDoctorService.mjs";
import {
  getBrowserMemoryStats,
  saveBrowserMemoryRecord,
  searchBrowserMemoryRecords,
} from "./SabrinaMemoryBridgeService.mjs";
import {
  ensureSabrinaRelayConnectCode,
  getSabrinaRelayPairingState,
} from "./SabrinaRemotePairingService.mjs";
import {
  listSabrinaRelayEnvelopes,
  sendSabrinaRelayEnvelope,
} from "./relay/SabrinaRelayClient.mjs";
import { buildLocalGatewayStatus } from "./OpenClawStatusService.mjs";
import {
  getTurnJournalStats,
  listTurnJournalEntries,
  pruneTurnJournalEntries,
  searchTurnJournalEntries,
} from "../turns/TurnJournalStore.mjs";
import { setOpenClawTransportContext } from "./OpenClawTransportContext.mjs";

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function buildOpenClawRuntimeInsights(input = {}) {
  const state = input?.state && typeof input.state === "object" ? input.state : null;
  const connectionState =
    state?.connectionState && typeof state.connectionState === "object"
      ? state.connectionState
      : null;
  const skillSummary =
    state?.skillCatalog?.summary && typeof state.skillCatalog.summary === "object"
      ? state.skillCatalog.summary
      : null;
  const turnJournalStats =
    input?.turnJournalStats && typeof input.turnJournalStats === "object"
      ? input.turnJournalStats
      : null;
  const browserMemoryStats =
    input?.browserMemoryStats && typeof input.browserMemoryStats === "object"
      ? input.browserMemoryStats
      : null;

  return {
    remoteSessionContract: connectionState?.remoteSessionContract ?? null,
    skillCatalog: skillSummary
      ? {
          browserCapabilitySchemaVersion:
            skillSummary.browserCapabilitySchemaVersion ?? null,
          total: Number(skillSummary.total ?? 0),
          eligible: Number(skillSummary.eligible ?? 0),
          ready: Number(skillSummary.ready ?? 0),
          disabled: Number(skillSummary.disabled ?? 0),
          blockedByAllowlist: Number(skillSummary.blockedByAllowlist ?? 0),
          missingRequirements: Number(skillSummary.missingRequirements ?? 0),
          capabilitySourceCounts: {
            declared: Number(skillSummary.capabilitySourceCounts?.declared ?? 0),
            overlay: Number(skillSummary.capabilitySourceCounts?.overlay ?? 0),
            heuristic: Number(skillSummary.capabilitySourceCounts?.heuristic ?? 0),
            metadata: Number(skillSummary.capabilitySourceCounts?.metadata ?? 0),
          },
        }
      : null,
    turnJournal: turnJournalStats,
    browserMemory: browserMemoryStats,
  };
}

export function buildOpenClawSupportSnapshot(input = {}) {
  return {
    ok: true,
    capturedAt:
      typeof input?.capturedAt === "string" && input.capturedAt.trim()
        ? input.capturedAt.trim()
        : new Date().toISOString(),
    state: input?.state && typeof input.state === "object" ? input.state : null,
    connectionState:
      input?.connectionState && typeof input.connectionState === "object"
        ? input.connectionState
        : input?.state?.connectionState && typeof input.state.connectionState === "object"
          ? input.state.connectionState
          : null,
    runtimeInsights:
      input?.runtimeInsights && typeof input.runtimeInsights === "object"
        ? input.runtimeInsights
        : null,
    turnJournal:
      input?.turnJournal && typeof input.turnJournal === "object"
        ? input.turnJournal
        : { ok: true, entries: [], stats: null },
    browserMemory:
      input?.browserMemory && typeof input.browserMemory === "object"
        ? input.browserMemory
        : { ok: true, query: "", records: [], stats: null },
  };
}

export function getSerializedOpenClawState() {
  return serializeOpenClawState();
}

export function refreshOpenClawRuntimeState(payload = {}) {
  return refreshOpenClawState(payload ?? {});
}

export function getOpenClawConnectionState() {
  return serializeOpenClawState().connectionState;
}

export function selectOpenClawBindingTarget(target) {
  return setOpenClawSelectedTarget(target, { refresh: true });
}

export async function setOpenClawLocalModel(params = {}) {
  try {
    await setLocalModel(params ?? {});
    return refreshOpenClawState();
  } catch (error) {
    await patchOpenClawState({
      lastError: getErrorMessage(error),
    }).catch(() => {});
    throw error;
  }
}

export async function beginOpenClawBindingSetup(params = {}) {
  return connectOpenClaw(params);
}

export async function connectOpenClaw(params = {}) {
  const target =
    (typeof params?.target === "string" && params.target.trim() === "remote") ||
    (`${params?.driver ?? ""}`.trim() && `${params?.driver ?? ""}`.trim() !== "local-cli") ||
    `${params?.sshTarget ?? ""}`.trim() ||
    `${params?.relayUrl ?? ""}`.trim() ||
    `${params?.connectCode ?? ""}`.trim()
      ? "remote"
      : "local";
  const connectionConfig = normalizeConnectionConfig(
    {
      ...serializeOpenClawState().connectionConfig,
      enabled: true,
      transport: target,
      profile: params?.profile,
      stateDir: params?.stateDir,
      driver: params?.driver,
      sshTarget: params?.sshTarget,
      sshPort: params?.sshPort,
      relayUrl: params?.relayUrl,
      connectCode: params?.connectCode,
      label: params?.label,
      agentId: params?.agentId,
    },
    target,
  );
  setOpenClawTransportContext(connectionConfig);

  await setOpenClawSelectedTarget(target, {
    refresh: false,
    status: "bootstrapping",
  });
  await patchOpenClawState({
    selectedTarget: target,
    connectionConfig,
    lastError: "",
  });

  const bindingSetupState = await beginBindingSetup({ target });
  const nextState = await refreshOpenClawState({ target, connectionConfig });
  const finalizedState = await patchOpenClawState({
    selectedTarget: target,
    connectionConfig,
    bindingSetupState,
    lastError:
      bindingSetupState?.status === "degraded" && bindingSetupState?.note
        ? bindingSetupState.note
        : nextState?.lastError ?? "",
    activeConnectionId:
      target === "remote"
        ? createSavedConnectionRecord({
            connectionConfig,
            status: nextState?.connectionState?.status,
            lastUsedAt: new Date().toISOString(),
            lastConnectedAt: nextState?.binding?.lastConnectedAt ?? null,
          }).id
        : null,
  });

  if (target === "remote") {
    return saveOpenClawSavedConnection({
      connectionConfig,
      status: finalizedState?.connectionState?.status,
      lastUsedAt: new Date().toISOString(),
      lastConnectedAt: finalizedState?.binding?.lastConnectedAt ?? null,
      markActive: true,
    });
  }

  return finalizedState;
}

export async function disconnectOpenClaw(params = {}) {
  const currentState = serializeOpenClawState();
  const target =
    (typeof params?.target === "string" && params.target.trim() === "remote") ||
    (`${params?.driver ?? ""}`.trim() && `${params?.driver ?? ""}`.trim() !== "local-cli") ||
    `${params?.sshTarget ?? ""}`.trim() ||
    `${params?.relayUrl ?? ""}`.trim() ||
    `${params?.connectCode ?? ""}`.trim()
      ? "remote"
      : currentState.selectedTarget;
  const connectionConfig = normalizeConnectionConfig(
    {
      ...currentState.connectionConfig,
      enabled: false,
      transport: target,
      profile: params?.profile ?? currentState.connectionConfig?.profile,
      stateDir: params?.stateDir ?? currentState.connectionConfig?.stateDir,
      driver: params?.driver ?? currentState.connectionConfig?.driver,
      sshTarget: params?.sshTarget ?? currentState.connectionConfig?.sshTarget,
      sshPort: params?.sshPort ?? currentState.connectionConfig?.sshPort,
      relayUrl: params?.relayUrl ?? currentState.connectionConfig?.relayUrl,
      connectCode: params?.connectCode ?? currentState.connectionConfig?.connectCode,
      label: params?.label ?? currentState.connectionConfig?.label,
      agentId: params?.agentId ?? currentState.connectionConfig?.agentId,
    },
    target,
  );
  setOpenClawTransportContext(connectionConfig);
  await patchOpenClawState({
    selectedTarget: target,
    connectionConfig,
    binding: null,
    modelState: null,
    skillCatalog: null,
    bindingSetupState: createDefaultBindingSetupState(target),
    lastError: "",
  });
  return refreshOpenClawState({ target, connectionConfig });
}

export async function saveOpenClawConnectionPreset(params = {}) {
  const target =
    (typeof params?.target === "string" && params.target.trim() === "remote") ||
    (`${params?.driver ?? ""}`.trim() && `${params?.driver ?? ""}`.trim() !== "local-cli") ||
    `${params?.sshTarget ?? ""}`.trim() ||
    `${params?.relayUrl ?? ""}`.trim()
      ? "remote"
      : "local";
  const connectionConfig = normalizeConnectionConfig(
    {
      ...serializeOpenClawState().connectionConfig,
      transport: target,
      driver: params?.driver,
      profile: params?.profile,
      stateDir: params?.stateDir,
      sshTarget: params?.sshTarget,
      sshPort: params?.sshPort,
      relayUrl: params?.relayUrl,
      connectCode: params?.connectCode,
      label: params?.label,
      agentId: params?.agentId,
    },
    target,
  );

  return saveOpenClawSavedConnection({
    id: params?.id,
    name: params?.name,
    connectionConfig,
    status: params?.status,
    lastUsedAt: params?.lastUsedAt ?? new Date().toISOString(),
    lastConnectedAt: params?.lastConnectedAt ?? null,
    markActive: params?.markActive,
  });
}

export async function removeSavedOpenClawConnection(savedConnectionId) {
  return removeOpenClawSavedConnection(savedConnectionId);
}

export async function selectSavedOpenClawConnection(savedConnectionId) {
  return selectOpenClawSavedConnection(savedConnectionId);
}

function buildProbeResult(params = {}) {
  const checks = Array.isArray(params?.checks) ? params.checks : [];
  const failures = checks.filter((check) => check.status === "fail");
  const warnings = checks.filter((check) => check.status === "warn");
  return {
    ok: failures.length === 0,
    target: params?.target ?? "local",
    transport: params?.transport ?? "local",
    driver: params?.driver ?? null,
    summary:
      typeof params?.summary === "string" && params.summary.trim()
        ? params.summary.trim()
        : failures.length > 0
          ? "连接前检查发现问题"
          : warnings.length > 0
            ? "目标可用，但还有一些提醒"
            : "目标可用，可以继续连接",
    detail:
      typeof params?.detail === "string" && params.detail.trim()
        ? params.detail.trim()
        : "",
    checkCount: checks.length,
    failureCount: failures.length,
    warningCount: warnings.length,
    checks,
    checkedAt: new Date().toISOString(),
  };
}

export async function probeOpenClawConnection(params = {}) {
  const target =
    (typeof params?.target === "string" && params.target.trim() === "remote") ||
    (`${params?.driver ?? ""}`.trim() && `${params?.driver ?? ""}`.trim() !== "local-cli") ||
    `${params?.sshTarget ?? ""}`.trim() ||
    `${params?.relayUrl ?? ""}`.trim() ||
    `${params?.connectCode ?? ""}`.trim()
      ? "remote"
      : "local";
  const connectionConfig = normalizeConnectionConfig(
    {
      ...serializeOpenClawState().connectionConfig,
      transport: target,
      driver: params?.driver,
      profile: params?.profile,
      stateDir: params?.stateDir,
      sshTarget: params?.sshTarget,
      sshPort: params?.sshPort,
      relayUrl: params?.relayUrl,
      connectCode: params?.connectCode,
      label: params?.label,
      agentId: params?.agentId,
    },
    target,
  );
  const checks = [];
  const transportProbe = await probeOpenClawTransport({
    timeout: target === "remote" ? 5_000 : 3_000,
    context: connectionConfig,
  }).catch((error) => ({
    ok: false,
    detail: getErrorMessage(error),
  }));
  checks.push({
    id: "transport",
    label: target === "remote" ? "远程目标" : "本机 OpenClaw",
    status: transportProbe.ok ? "pass" : "fail",
    detail:
      transportProbe.ok
        ? target === "remote"
          ? "目标可达"
          : "本机 OpenClaw 可达"
        : transportProbe.detail || "无法建立连接",
  });

  if (!transportProbe.ok) {
    return buildProbeResult({
      target,
      transport: connectionConfig.transport,
      driver: connectionConfig.driver,
      detail: transportProbe.detail,
      checks,
    });
  }

  try {
    const [statusPayload, healthPayload] = await Promise.all([
      execOpenClawJson(["gateway", "status", "--json"], {
        timeout: 8_000,
        retries: 0,
        context: connectionConfig,
      }),
      execOpenClawJson(["gateway", "health", "--json"], {
        timeout: 8_000,
        retries: 0,
        context: connectionConfig,
      }),
    ]);
    const gatewayStatus = buildLocalGatewayStatus(statusPayload, healthPayload);
    checks.push({
      id: "gateway",
      label: "Gateway",
      status: gatewayStatus.ok ? "pass" : "fail",
      detail: gatewayStatus.ok
        ? `${gatewayStatus.bindHost}:${gatewayStatus.port} · ${gatewayStatus.serviceStatus}`
        : gatewayStatus.warnings[0] || "Gateway 未就绪",
    });
  } catch (error) {
    checks.push({
      id: "gateway",
      label: "Gateway",
      status: "fail",
      detail: getErrorMessage(error),
    });
  }

  if (target === "remote") {
    try {
      const modelsStatus = await execOpenClawJson(["models", "status", "--json"], {
        timeout: 8_000,
        retries: 0,
        context: connectionConfig,
      });
      checks.push({
        id: "models",
        label: "默认模型",
        status: modelsStatus?.resolvedDefault ? "pass" : "warn",
        detail: modelsStatus?.resolvedDefault
          ? `${modelsStatus.resolvedDefault} · ${Array.isArray(modelsStatus.allowed) ? modelsStatus.allowed.length : 0} 个可用模型`
          : "还没有解析出默认模型",
      });
    } catch (error) {
      checks.push({
        id: "models",
        label: "默认模型",
        status: "warn",
        detail: getErrorMessage(error),
      });
    }

    try {
      const sessionsStatus = await execOpenClawJson(
        ["sessions", "--all-agents", "--active", "180", "--json"],
        {
          timeout: 8_000,
          retries: 0,
          context: connectionConfig,
        },
      );
      const latestSession = Array.isArray(sessionsStatus?.sessions)
        ? sessionsStatus.sessions[0]
        : null;
      checks.push({
        id: "sessions",
        label: "最近会话",
        status: latestSession ? "pass" : "warn",
        detail: latestSession
          ? `${latestSession.agentId || "agent"} · ${latestSession.modelProvider || "provider"} / ${latestSession.model || "model"}`
          : "180 分钟内没有活跃会话",
      });
    } catch (error) {
      checks.push({
        id: "sessions",
        label: "最近会话",
        status: "warn",
        detail: getErrorMessage(error),
      });
    }
  }

  const failures = checks.filter((check) => check.status === "fail");
  return buildProbeResult({
    target,
    transport: connectionConfig.transport,
    driver: connectionConfig.driver,
    summary:
      failures.length === 0
        ? target === "remote"
          ? "这台远程 OpenClaw 可用"
          : "本机 OpenClaw 可用"
        : "连接前检查发现问题",
    detail:
      failures.length === 0
        ? target === "remote"
          ? "现在可以直接连接，或者先保存这台龙虾。"
          : "现在可以直接开始连接。"
        : failures[0]?.detail || "",
    checks,
  });
}

export async function approveOpenClawPairingRequest(params = {}) {
  try {
    await approveLocalPairingRequest(params ?? {});
    return refreshOpenClawState();
  } catch (error) {
    await patchOpenClawState({
      lastError: getErrorMessage(error),
    }).catch(() => {});
    throw error;
  }
}

export async function approveOpenClawDeviceRequest(params = {}) {
  try {
    await approveLocalDeviceRequest(params ?? {});
    return refreshOpenClawState();
  } catch (error) {
    await patchOpenClawState({
      lastError: getErrorMessage(error),
    }).catch(() => {});
    throw error;
  }
}

export async function ensureRequestedSkillModel(agentId, requestedModel) {
  const normalizedAgentId = `${agentId ?? ""}`.trim();
  const normalizedRequestedModel = `${requestedModel ?? ""}`.trim();
  if (!normalizedAgentId || !normalizedRequestedModel) {
    return null;
  }

  const currentModelState = await getLocalModelState(normalizedAgentId);
  const allowedIds = new Set(
    Array.isArray(currentModelState?.models)
      ? currentModelState.models.map((model) => model.id)
      : [],
  );

  if (allowedIds.size > 0 && !allowedIds.has(normalizedRequestedModel)) {
    throw new Error(`OpenClaw 当前没有放开模型 ${normalizedRequestedModel}`);
  }

  if (
    currentModelState?.desiredModel === normalizedRequestedModel &&
    currentModelState?.appliedModel === normalizedRequestedModel
  ) {
    return currentModelState;
  }

  const nextModelState = await setLocalModel({
    agentId: normalizedAgentId,
    model: normalizedRequestedModel,
  });
  await refreshOpenClawState();
  return nextModelState;
}

export async function doctorOpenClaw(params = {}) {
  return buildOpenClawDoctorReport({
    target: params?.target,
    connectionConfig:
      params?.connectionConfig ??
      {
        transport: params?.target,
        driver: params?.driver,
        profile: params?.profile,
        stateDir: params?.stateDir,
        sshTarget: params?.sshTarget,
        sshPort: params?.sshPort,
        relayUrl: params?.relayUrl,
        connectCode: params?.connectCode,
        label: params?.label,
        agentId: params?.agentId,
      },
    state: serializeOpenClawState(),
  });
}

export async function createOpenClawRelayConnectCode(params = {}) {
  return ensureSabrinaRelayConnectCode({
    relayUrl: params?.relayUrl,
    ttlMs: params?.ttlMs,
    publish: params?.publish ?? true,
  });
}

export async function getOpenClawRelayPairingState(params = {}) {
  return getSabrinaRelayPairingState({
    relayUrl: params?.relayUrl,
    connectCode: params?.connectCode,
  });
}

export async function sendOpenClawRelayEnvelope(params = {}) {
  return sendSabrinaRelayEnvelope(params?.relayUrl, params?.sessionId, {
    type: params?.type,
    from: params?.from,
    to: params?.to,
    payload: params?.payload,
    ciphertext: params?.ciphertext,
    nonce: params?.nonce,
  });
}

export async function listOpenClawRelayEnvelopes(params = {}) {
  return listSabrinaRelayEnvelopes(params?.relayUrl, params?.sessionId, {
    recipient: params?.recipient,
    afterSeq: params?.afterSeq,
  });
}

export async function saveOpenClawBrowserMemory(params = {}) {
  const record = await saveBrowserMemoryRecord(params);
  return {
    ok: true,
    record,
    stats: await getBrowserMemoryStats(),
  };
}

export async function searchOpenClawBrowserMemory(params = {}) {
  const records = await searchBrowserMemoryRecords(params?.query, {
    limit: params?.limit,
  });
  return {
    ok: true,
    query: `${params?.query ?? ""}`.trim(),
    records,
    stats: await getBrowserMemoryStats(),
  };
}

export async function getOpenClawRuntimeInsights() {
  const state = serializeOpenClawState();
  const browserMemoryStats = await getBrowserMemoryStats();
  const turnJournalStats = getTurnJournalStats();

  return buildOpenClawRuntimeInsights({
    state,
    browserMemoryStats,
    turnJournalStats,
  });
}

export async function getOpenClawSupportSnapshot(params = {}) {
  const state = serializeOpenClawState();
  const runtimeInsights = await getOpenClawRuntimeInsights();
  const turnJournal = await getOpenClawTurnJournal({
    limit: params?.turnJournalLimit ?? params?.limit,
    threadId: params?.threadId,
    status: params?.status,
  });
  const browserMemory = await searchOpenClawBrowserMemory({
    query: params?.memoryQuery ?? "",
    limit: params?.browserMemoryLimit ?? params?.limit,
  });

  return buildOpenClawSupportSnapshot({
    capturedAt: new Date().toISOString(),
    state,
    connectionState: state?.connectionState ?? null,
    runtimeInsights,
    turnJournal,
    browserMemory,
  });
}

export async function getOpenClawTurnJournal(params = {}) {
  return {
    ok: true,
    entries: listTurnJournalEntries({
      limit: params?.limit,
      threadId: params?.threadId,
      status: params?.status,
    }),
    stats: getTurnJournalStats(),
  };
}

export async function searchOpenClawTurnJournal(params = {}) {
  return {
    ok: true,
    query: `${params?.query ?? ""}`.trim(),
    entries: searchTurnJournalEntries(params?.query, {
      limit: params?.limit,
    }),
    stats: getTurnJournalStats(),
  };
}

export async function pruneOpenClawTurnJournal(params = {}) {
  return pruneTurnJournalEntries({
    keepLatest: params?.keepLatest,
  });
}
