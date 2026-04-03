import {
  approveLocalDeviceRequest,
  approveLocalPairingRequest,
  beginBindingSetup,
  getLocalModelState,
  setLocalModel,
} from "./OpenClawManager.mjs";
import {
  patchOpenClawState,
  refreshOpenClawState,
  serializeOpenClawState,
  setOpenClawSelectedTarget,
} from "./OpenClawStateStore.mjs";
import {
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
  getTurnJournalStats,
  listTurnJournalEntries,
  searchTurnJournalEntries,
} from "../turns/TurnJournalStore.mjs";
import { setOpenClawTransportContext } from "./OpenClawTransportContext.mjs";

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
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
    `${params?.relayUrl ?? ""}`.trim()
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

  return patchOpenClawState({
    selectedTarget: target,
    connectionConfig,
    bindingSetupState,
    lastError:
      bindingSetupState?.status === "degraded" && bindingSetupState?.note
        ? bindingSetupState.note
        : nextState?.lastError ?? "",
  });
}

export async function disconnectOpenClaw(params = {}) {
  const currentState = serializeOpenClawState();
  const target =
    (typeof params?.target === "string" && params.target.trim() === "remote") ||
    (`${params?.driver ?? ""}`.trim() && `${params?.driver ?? ""}`.trim() !== "local-cli") ||
    `${params?.sshTarget ?? ""}`.trim() ||
    `${params?.relayUrl ?? ""}`.trim()
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
