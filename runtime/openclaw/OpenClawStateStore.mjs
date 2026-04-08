import fs from "node:fs/promises";
import path from "node:path";
import {
  buildRefreshedOpenClawState,
} from "./OpenClawSnapshotService.mjs";
import {
  createConnectionConfigFromSavedRecord,
  createConnectionState,
  createDefaultConnectionConfig,
  createDefaultBindingSetupState,
  createDefaultOpenClawState,
  createSavedConnectionRecord,
  normalizeConnectionConfig,
  normalizeSavedConnections,
  normalizeTarget,
} from "./OpenClawStateModel.mjs";

let mainWindowGetter = () => null;
let resolveStatePath = () => path.join(process.cwd(), "openclaw-state.json");
let recordOpenClawEvent = () => {};
let persistQueue = Promise.resolve();
let persistNonce = 0;

let state = createDefaultOpenClawState();

function normalizeOpenClawState(rawState) {
  const selectedTarget = normalizeTarget(rawState?.selectedTarget);

  return {
    selectedTarget,
    connectionConfig: normalizeConnectionConfig(rawState?.connectionConfig, selectedTarget),
    connectionState:
      rawState?.connectionState && typeof rawState.connectionState === "object"
        ? rawState.connectionState
        : createConnectionState({
            target: selectedTarget,
            connectionConfig: normalizeConnectionConfig(rawState?.connectionConfig, selectedTarget),
            binding: rawState?.binding ?? null,
            gatewayStatus: rawState?.gatewayStatus ?? null,
            bindingSetupState:
              rawState?.bindingSetupState && typeof rawState.bindingSetupState === "object"
                ? {
                    ...createDefaultBindingSetupState(selectedTarget),
                    ...rawState.bindingSetupState,
                    target: selectedTarget,
                  }
                : createDefaultBindingSetupState(selectedTarget),
            lastError:
              typeof rawState?.lastError === "string" && rawState.lastError.trim()
                ? rawState.lastError.trim()
                : "",
            lastRefreshedAt:
              typeof rawState?.lastRefreshedAt === "string" && rawState.lastRefreshedAt.trim()
                ? rawState.lastRefreshedAt.trim()
                : null,
          }),
    binding: rawState?.binding ?? null,
    bindingSetupState:
      rawState?.bindingSetupState && typeof rawState.bindingSetupState === "object"
        ? {
            ...createDefaultBindingSetupState(selectedTarget),
            ...rawState.bindingSetupState,
            target: selectedTarget,
          }
        : createDefaultBindingSetupState(selectedTarget),
    modelState: rawState?.modelState ?? null,
    skillCatalog: rawState?.skillCatalog ?? null,
    gatewayStatus: rawState?.gatewayStatus ?? null,
    deviceStatus: rawState?.deviceStatus ?? null,
    pairingStatus: rawState?.pairingStatus ?? null,
    savedConnections: normalizeSavedConnections(rawState?.savedConnections),
    activeConnectionId:
      typeof rawState?.activeConnectionId === "string" && rawState.activeConnectionId.trim()
        ? rawState.activeConnectionId.trim()
        : null,
    lastRefreshedAt:
      typeof rawState?.lastRefreshedAt === "string" && rawState.lastRefreshedAt.trim()
        ? rawState.lastRefreshedAt.trim()
        : null,
    lastError:
      typeof rawState?.lastError === "string" && rawState.lastError.trim()
        ? rawState.lastError.trim()
        : "",
  };
}

async function readJsonFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function persistOpenClawState() {
  const filePath = resolveStatePath();
  const payload = JSON.stringify(state, null, 2);
  const queuedPersist = persistQueue.catch(() => {}).then(async () => {
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}-${persistNonce++}.tmp`;

    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(tmpPath, payload, "utf8");
      await fs.rename(tmpPath, filePath);
    } catch (error) {
      await fs.rm(tmpPath, { force: true }).catch(() => {});
      recordOpenClawEvent("error", "openclaw", "持久化 OpenClaw 运行态失败", {
        source: "main",
        kind: "openclaw-state-persist-failure",
        details: { message: error instanceof Error ? error.message : String(error) },
      });
    }
  });

  persistQueue = queuedPersist;
  return queuedPersist;
}

export function initOpenClawStateStore(host = {}) {
  mainWindowGetter = typeof host?.getMainWindow === "function" ? host.getMainWindow : () => null;
  resolveStatePath =
    typeof host?.resolveStatePath === "function"
      ? host.resolveStatePath
      : () => path.join(process.cwd(), "openclaw-state.json");
  recordOpenClawEvent = typeof host?.recordEvent === "function" ? host.recordEvent : () => {};
}

export async function loadOpenClawStateStore() {
  const raw = await readJsonFile(resolveStatePath());
  state = normalizeOpenClawState(raw);
}

export function serializeOpenClawState() {
  return {
    selectedTarget: state.selectedTarget,
    connectionConfig: { ...state.connectionConfig },
    connectionState: state.connectionState ? { ...state.connectionState } : null,
    binding: state.binding ? { ...state.binding } : null,
    bindingSetupState: {
      ...state.bindingSetupState,
      steps: Array.isArray(state.bindingSetupState?.steps)
        ? state.bindingSetupState.steps.map((step) => ({ ...step }))
        : [],
    },
    modelState: state.modelState
      ? {
          ...state.modelState,
          models: Array.isArray(state.modelState.models)
            ? state.modelState.models.map((model) => ({ ...model }))
            : [],
        }
      : null,
    skillCatalog: state.skillCatalog
      ? {
          summary: { ...state.skillCatalog.summary },
          skills: Array.isArray(state.skillCatalog.skills)
            ? state.skillCatalog.skills.map((skill) => ({ ...skill }))
            : [],
        }
      : null,
    gatewayStatus: state.gatewayStatus
      ? {
          ...state.gatewayStatus,
          warnings: Array.isArray(state.gatewayStatus.warnings)
            ? [...state.gatewayStatus.warnings]
            : [],
          agentIds: Array.isArray(state.gatewayStatus.agentIds)
            ? [...state.gatewayStatus.agentIds]
            : [],
        }
      : null,
    deviceStatus: state.deviceStatus
      ? {
          ...state.deviceStatus,
          pairedDevices: Array.isArray(state.deviceStatus.pairedDevices)
            ? state.deviceStatus.pairedDevices.map((device) => ({
                ...device,
                roles: Array.isArray(device.roles) ? [...device.roles] : [],
              }))
            : [],
        }
      : null,
    pairingStatus: state.pairingStatus
      ? {
          ...state.pairingStatus,
          requests: Array.isArray(state.pairingStatus.requests)
            ? state.pairingStatus.requests.map((request) => ({ ...request }))
            : [],
        }
      : null,
    savedConnections: Array.isArray(state.savedConnections)
      ? state.savedConnections.map((entry) => ({ ...entry }))
      : [],
    activeConnectionId: state.activeConnectionId,
    lastRefreshedAt: state.lastRefreshedAt,
    lastError: state.lastError,
  };
}

export function emitOpenClawState() {
  const win = mainWindowGetter();
  if (!win || win.isDestroyed()) {
    return;
  }

  win.webContents.send("openclaw:state", serializeOpenClawState());
}

async function commitOpenClawState(nextState) {
  state = normalizeOpenClawState(nextState);
  await persistOpenClawState();
  emitOpenClawState();
  return serializeOpenClawState();
}

export async function patchOpenClawState(partialState = {}) {
  const nextBindingSetupState =
    partialState?.bindingSetupState && typeof partialState.bindingSetupState === "object"
      ? {
          ...state.bindingSetupState,
          ...partialState.bindingSetupState,
          ...(Array.isArray(partialState.bindingSetupState.steps)
            ? { steps: partialState.bindingSetupState.steps }
            : {}),
        }
      : state.bindingSetupState;

  const nextSelectedTarget = normalizeTarget(partialState?.selectedTarget ?? state.selectedTarget);
  const nextConnectionConfig =
    partialState?.connectionConfig && typeof partialState.connectionConfig === "object"
      ? normalizeConnectionConfig(
          {
            ...state.connectionConfig,
            ...partialState.connectionConfig,
            transport: nextSelectedTarget,
          },
          nextSelectedTarget,
        )
      : normalizeConnectionConfig(
          {
            ...state.connectionConfig,
            transport: nextSelectedTarget,
          },
          nextSelectedTarget,
        );
  const nextConnectionState =
    partialState?.connectionState && typeof partialState.connectionState === "object"
      ? {
          ...state.connectionState,
          ...partialState.connectionState,
          target: nextSelectedTarget,
          transport: nextSelectedTarget,
        }
      : createConnectionState({
          target: nextSelectedTarget,
          connectionConfig: nextConnectionConfig,
          binding: partialState?.binding ?? state.binding,
          gatewayStatus: partialState?.gatewayStatus ?? state.gatewayStatus,
          bindingSetupState: nextBindingSetupState,
          lastError: partialState?.lastError ?? state.lastError,
          lastRefreshedAt: partialState?.lastRefreshedAt ?? state.lastRefreshedAt,
        });

  return commitOpenClawState({
    ...state,
    ...partialState,
    selectedTarget: nextSelectedTarget,
    connectionConfig: nextConnectionConfig,
    connectionState: nextConnectionState,
    bindingSetupState: nextBindingSetupState,
  });
}

export async function refreshOpenClawState(options = {}) {
  const nextState = await buildRefreshedOpenClawState(state, options);
  return commitOpenClawState(nextState);
}

export async function setOpenClawSelectedTarget(target, options = {}) {
  const statusOverride = typeof options?.status === "string" ? options.status : null;
  const normalizedTarget = normalizeTarget(target);
  const nextBindingSetupState = {
    ...createDefaultBindingSetupState(normalizedTarget),
    ...(statusOverride ? { status: statusOverride } : {}),
  };
  const nextState = {
    ...state,
    selectedTarget: normalizedTarget,
    connectionConfig: normalizeConnectionConfig(
      {
        ...state.connectionConfig,
        transport: normalizedTarget,
      },
      target,
    ),
    bindingSetupState: nextBindingSetupState,
  };
  await commitOpenClawState(nextState);

  if (options?.refresh === false) {
    return serializeOpenClawState();
  }

  return refreshOpenClawState({ target });
}

export async function saveOpenClawSavedConnection(savedConnection = {}) {
  const record = createSavedConnectionRecord(savedConnection);
  const nextSavedConnections = normalizeSavedConnections([
    ...state.savedConnections.filter((entry) => entry.id !== record.id),
    record,
  ]).sort((left, right) => {
    const leftStamp = left.lastUsedAt || left.lastConnectedAt || "";
    const rightStamp = right.lastUsedAt || right.lastConnectedAt || "";
    return rightStamp.localeCompare(leftStamp);
  });

  return commitOpenClawState({
    ...state,
    savedConnections: nextSavedConnections,
    activeConnectionId:
      savedConnection?.markActive === true ? record.id : state.activeConnectionId,
  });
}

export async function removeOpenClawSavedConnection(savedConnectionId) {
  const targetId = `${savedConnectionId ?? ""}`.trim();
  if (!targetId) {
    return serializeOpenClawState();
  }

  return commitOpenClawState({
    ...state,
    savedConnections: state.savedConnections.filter((entry) => entry.id !== targetId),
    activeConnectionId: state.activeConnectionId === targetId ? null : state.activeConnectionId,
  });
}

export async function selectOpenClawSavedConnection(savedConnectionId) {
  const targetId = `${savedConnectionId ?? ""}`.trim();
  const savedConnection = state.savedConnections.find((entry) => entry.id === targetId) ?? null;
  if (!savedConnection) {
    throw new Error("未找到已保存的 OpenClaw 目标。");
  }

  const nextTarget = normalizeTarget(savedConnection.transport);
  const nextConnectionConfig = createConnectionConfigFromSavedRecord(savedConnection);
  const nextBindingSetupState = createDefaultBindingSetupState(nextTarget);

  return commitOpenClawState({
    ...state,
    selectedTarget: nextTarget,
    connectionConfig: nextConnectionConfig,
    activeConnectionId: savedConnection.id,
    bindingSetupState: nextBindingSetupState,
    connectionState: createConnectionState({
      target: nextTarget,
      connectionConfig: nextConnectionConfig,
      binding: null,
      gatewayStatus: null,
      bindingSetupState: nextBindingSetupState,
      lastError: "",
      lastRefreshedAt: state.lastRefreshedAt,
    }),
  });
}
