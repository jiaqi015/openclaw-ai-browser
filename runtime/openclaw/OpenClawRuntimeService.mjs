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
    typeof params?.target === "string" && params.target.trim() === "remote"
      ? "remote"
      : "local";
  const connectionConfig = normalizeConnectionConfig(
    {
      ...serializeOpenClawState().connectionConfig,
      enabled: true,
      transport: target,
      profile: params?.profile,
      stateDir: params?.stateDir,
    },
    target,
  );
  setOpenClawTransportContext(connectionConfig);

  await setOpenClawSelectedTarget(target, {
    refresh: false,
    status: target === "remote" ? "degraded" : "bootstrapping",
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
    typeof params?.target === "string" && params.target.trim() === "remote"
      ? "remote"
      : currentState.selectedTarget;
  const connectionConfig = normalizeConnectionConfig(
    {
      ...currentState.connectionConfig,
      enabled: false,
      transport: target,
      profile: params?.profile ?? currentState.connectionConfig?.profile,
      stateDir: params?.stateDir ?? currentState.connectionConfig?.stateDir,
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
    connectionConfig: params?.connectionConfig,
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
