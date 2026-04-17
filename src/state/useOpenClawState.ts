import { useEffect, useRef, useState } from "react";
import {
  applyProjectedRuntimeState,
  createEmptyOpenClawState,
  useOpenClawRuntimeProjection,
} from "./openclaw-runtime-projection";

type SabrinaDesktop = NonNullable<Window["sabrinaDesktop"]>;
type SabrinaDesktopOpenClaw = NonNullable<SabrinaDesktop["openclaw"]>;
type SabrinaSupportSnapshot = Awaited<
  ReturnType<NonNullable<SabrinaDesktopOpenClaw["getSupportSnapshot"]>>
>;
type SabrinaTurnJournalSnapshot = Awaited<
  ReturnType<SabrinaDesktopOpenClaw["getTurnJournal"]>
>;
type SabrinaBrowserMemorySnapshot = Awaited<
  ReturnType<SabrinaDesktopOpenClaw["searchMemory"]>
>;

export function useOpenClawState(desktop?: SabrinaDesktop) {
  const [runtimeState, setRuntimeState] = useState<SabrinaOpenClawState>(
    createEmptyOpenClawState("local"),
  );
  const [doctorReport, setDoctorReport] = useState<SabrinaOpenClawDoctorReport | null>(null);
  const [connectionProbe, setConnectionProbe] =
    useState<SabrinaOpenClawConnectionProbeResult | null>(null);
  const [supportSnapshot, setSupportSnapshot] = useState<SabrinaSupportSnapshot | null>(null);
  const [turnJournalSnapshot, setTurnJournalSnapshot] =
    useState<SabrinaTurnJournalSnapshot | null>(null);
  const [browserMemorySnapshot, setBrowserMemorySnapshot] =
    useState<SabrinaBrowserMemorySnapshot | null>(null);
  const [isModelSwitching, setIsModelSwitching] = useState(false);
  const [approvingPairingRequestId, setApprovingPairingRequestId] = useState<string | null>(null);
  const [isApprovingLatestDevice, setIsApprovingLatestDevice] = useState(false);
  const selectedBindingTargetRef = useRef<"local" | "remote">(runtimeState.selectedTarget);
  selectedBindingTargetRef.current = runtimeState.selectedTarget;

  function applyRuntimeState(nextState: SabrinaOpenClawState | null | undefined) {
    applyProjectedRuntimeState(setRuntimeState, nextState);
  }

  useOpenClawRuntimeProjection({
    desktop,
    setRuntimeState,
    selectedBindingTargetRef,
  });

  const binding = runtimeState.binding;
  const connectionConfig = runtimeState.connectionConfig;
  const connectionState = runtimeState.connectionState;
  const bindingSetupState = runtimeState.bindingSetupState;
  const skillCatalog = runtimeState.skillCatalog;
  const modelState = runtimeState.modelState;
  const gatewayStatus = runtimeState.gatewayStatus;
  const deviceStatus = runtimeState.deviceStatus;
  const pairingStatus = runtimeState.pairingStatus;
  const savedConnections = runtimeState.savedConnections ?? [];
  const activeConnectionId = runtimeState.activeConnectionId ?? null;
  const lastError = runtimeState.lastError;
  const modelOptions = modelState?.models ?? [];
  const selectedModel = modelState?.desiredModel ?? modelState?.appliedModel ?? "";
  const turnJournalEntries = turnJournalSnapshot?.entries ?? [];
  const turnJournalStats = turnJournalSnapshot?.stats ?? null;
  const browserMemoryRecords = browserMemorySnapshot?.records ?? [];
  const browserMemoryStats = browserMemorySnapshot?.stats ?? null;

  useEffect(() => {
  const openclaw = desktop?.openclaw;
    if (!openclaw?.getSupportSnapshot && (!openclaw?.getTurnJournal || !openclaw?.searchMemory)) {
      setSupportSnapshot(null);
      setTurnJournalSnapshot(null);
      setBrowserMemorySnapshot(null);
      return;
    }

    let mounted = true;

    const loadSnapshots = openclaw.getSupportSnapshot
      ? openclaw.getSupportSnapshot({
          turnJournalLimit: 3,
          browserMemoryLimit: 3,
        })
      : Promise.all([
          openclaw.getTurnJournal({ limit: 3 }),
          openclaw.searchMemory({ query: "", limit: 3 }),
        ]).then(([journalSnapshot, memorySnapshot]) => ({
          ok: true,
          capturedAt: new Date().toISOString(),
          state: null,
          connectionState: null,
          runtimeInsights: null,
          turnJournal: journalSnapshot,
          browserMemory: memorySnapshot,
        }));

    loadSnapshots
      .then((snapshot) => {
        if (!mounted) {
          return;
        }

        setSupportSnapshot(snapshot);
        setTurnJournalSnapshot(snapshot.turnJournal);
        setBrowserMemorySnapshot(snapshot.browserMemory);
      })
      .catch(() => {
        if (!mounted) {
          return;
        }

        setSupportSnapshot(null);
        setTurnJournalSnapshot(null);
        setBrowserMemorySnapshot(null);
      });

    return () => {
      mounted = false;
    };
  }, [desktop, runtimeState.lastRefreshedAt, runtimeState.selectedTarget]);

  useEffect(() => {
    const openclaw = desktop?.openclaw;
    if (!openclaw?.refreshState) {
      return;
    }
    if (
      runtimeState.selectedTarget !== "remote" ||
      runtimeState.connectionConfig.driver !== "relay-paired" ||
      !runtimeState.connectionConfig.relayUrl ||
      !runtimeState.connectionConfig.connectCode
    ) {
      return;
    }

    let cancelled = false;
    async function refreshRelayProjection() {
      if (cancelled || typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      try {
        const nextState = await openclaw.refreshState({
          target: "remote",
        });
        if (!cancelled) {
          applyRuntimeState(nextState);
        }
      } catch {
        // Keep the latest remote snapshot when relay polling fails.
      }
    }

    const timer = window.setInterval(() => {
      void refreshRelayProjection();
    }, 5_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    desktop,
    runtimeState.connectionConfig.connectCode,
    runtimeState.connectionConfig.driver,
    runtimeState.connectionConfig.relayUrl,
    runtimeState.selectedTarget,
  ]);

  async function refreshOpenClawState(target = selectedBindingTargetRef.current) {
    const openclaw = desktop?.openclaw;
    if (!openclaw) {
      return null;
    }

    const nextState = openclaw.refreshState
      ? await openclaw.refreshState({ target })
      : await openclaw.getState();
    applyRuntimeState(nextState);
    return nextState;
  }

  async function switchSelectedModel(modelId: string) {
    const normalizedModelId = modelId.trim();
    if (!normalizedModelId || normalizedModelId === "__no-model__") {
      return;
    }

    const openclaw = desktop?.openclaw;
    if (!openclaw) {
      return;
    }

    if (!binding?.agentId) {
      throw new Error("当前还没有可用的龙虾代理。");
    }

    setIsModelSwitching(true);

    try {
      const allowedIds = new Set(modelOptions.map((model) => model.id));
      if (allowedIds.size > 0 && !allowedIds.has(normalizedModelId)) {
        throw new Error(`龙虾当前没有开放模型 ${normalizedModelId}`);
      }

      const nextState = await openclaw.setLocalModel({
        agentId: binding.agentId,
        model: normalizedModelId,
      });
      applyRuntimeState(nextState);
    } finally {
      setIsModelSwitching(false);
    }
  }

  function setBindingTarget(target: "local" | "remote") {
    const openclaw = desktop?.openclaw;
    if (!openclaw?.setBindingTarget) {
      return;
    }

    void openclaw
      .setBindingTarget(target)
      .then((nextState) => {
        applyRuntimeState(nextState);
      })
      .catch(() => {
        void refreshOpenClawState(target).catch(() => {});
      });
  }

  async function beginBindingSetup(target = runtimeState.selectedTarget) {
    return connectOpenClaw({ target });
  }

  async function connectOpenClaw(params?: {
    target?: "local" | "remote";
    profile?: string;
    stateDir?: string;
    driver?: "local-cli" | "ssh-cli" | "relay-paired" | "endpoint";
    sshTarget?: string;
    sshPort?: number;
    endpointUrl?: string;
    accessToken?: string;
    relayUrl?: string;
    connectCode?: string;
    label?: string;
    agentId?: string;
  }) {
    const openclaw = desktop?.openclaw;
    if (!openclaw?.connect) {
      return null;
    }

    const target =
      params?.target ??
      ((params?.driver && params.driver !== "local-cli") ||
      params?.sshTarget ||
      params?.endpointUrl ||
      params?.accessToken ||
      params?.relayUrl ||
      params?.connectCode
        ? "remote"
        : runtimeState.selectedTarget);
    const nextState = await openclaw.connect({
      target,
      profile: params?.profile,
      stateDir: params?.stateDir,
      driver: params?.driver,
      sshTarget: params?.sshTarget,
      sshPort: params?.sshPort,
      endpointUrl: params?.endpointUrl,
      accessToken: params?.accessToken,
      relayUrl: params?.relayUrl,
      connectCode: params?.connectCode,
      label: params?.label,
      agentId: params?.agentId,
    });
    applyRuntimeState(nextState);
    return nextState;
  }

  async function disconnectOpenClaw(params?: {
    target?: "local" | "remote";
    profile?: string;
    stateDir?: string;
    driver?: "local-cli" | "ssh-cli" | "relay-paired" | "endpoint";
    sshTarget?: string;
    sshPort?: number;
    endpointUrl?: string;
    accessToken?: string;
    relayUrl?: string;
    connectCode?: string;
    label?: string;
    agentId?: string;
  }) {
    const openclaw = desktop?.openclaw;
    if (!openclaw?.disconnect) {
      return null;
    }

    const nextState = await openclaw.disconnect({
      target:
        params?.target ??
        ((params?.driver && params.driver !== "local-cli") ||
        params?.sshTarget ||
        params?.endpointUrl ||
        params?.accessToken ||
        params?.relayUrl ||
        params?.connectCode
          ? "remote"
          : runtimeState.selectedTarget),
      profile: params?.profile,
      stateDir: params?.stateDir,
      driver: params?.driver,
      sshTarget: params?.sshTarget,
      sshPort: params?.sshPort,
      endpointUrl: params?.endpointUrl,
      accessToken: params?.accessToken,
      relayUrl: params?.relayUrl,
      connectCode: params?.connectCode,
      label: params?.label,
      agentId: params?.agentId,
    });
    applyRuntimeState(nextState);
    return nextState;
  }

  async function doctorOpenClaw(params?: {
    target?: "local" | "remote";
    profile?: string;
    stateDir?: string;
    driver?: "local-cli" | "ssh-cli" | "relay-paired" | "endpoint";
    sshTarget?: string;
    sshPort?: number;
    endpointUrl?: string;
    accessToken?: string;
    relayUrl?: string;
    connectCode?: string;
    label?: string;
    agentId?: string;
  }) {
    const openclaw = desktop?.openclaw;
    if (!openclaw?.doctor) {
      return null;
    }

    const report = await openclaw.doctor({
      target: params?.target ?? runtimeState.selectedTarget,
      profile: params?.profile,
      stateDir: params?.stateDir,
      driver: params?.driver,
      sshTarget: params?.sshTarget,
      sshPort: params?.sshPort,
      endpointUrl: params?.endpointUrl,
      accessToken: params?.accessToken,
      relayUrl: params?.relayUrl,
      connectCode: params?.connectCode,
      label: params?.label,
      agentId: params?.agentId,
    });
    setDoctorReport(report);
    return report;
  }

  async function probeConnection(params?: {
    target?: "local" | "remote";
    profile?: string;
    stateDir?: string;
    driver?: "local-cli" | "ssh-cli" | "relay-paired" | "endpoint";
    sshTarget?: string;
    sshPort?: number;
    endpointUrl?: string;
    accessToken?: string;
    relayUrl?: string;
    connectCode?: string;
    label?: string;
    agentId?: string;
  }) {
    const openclaw = desktop?.openclaw;
    if (!openclaw?.probeConnection) {
      return null;
    }

    const result = await openclaw.probeConnection({
      target: params?.target ?? runtimeState.selectedTarget,
      profile: params?.profile,
      stateDir: params?.stateDir,
      driver: params?.driver,
      sshTarget: params?.sshTarget,
      sshPort: params?.sshPort,
      endpointUrl: params?.endpointUrl,
      accessToken: params?.accessToken,
      relayUrl: params?.relayUrl,
      connectCode: params?.connectCode,
      label: params?.label,
      agentId: params?.agentId,
    });
    setConnectionProbe(result);
    return result;
  }

  async function saveConnectionPreset(params?: {
    id?: string;
    name?: string;
    target?: "local" | "remote";
    profile?: string;
    stateDir?: string;
    driver?: "local-cli" | "ssh-cli" | "relay-paired" | "endpoint";
    sshTarget?: string;
    sshPort?: number;
    endpointUrl?: string;
    accessToken?: string;
    relayUrl?: string;
    connectCode?: string;
    label?: string;
    agentId?: string;
    markActive?: boolean;
  }) {
    const openclaw = desktop?.openclaw;
    if (!openclaw?.saveConnectionPreset) {
      return null;
    }

    const nextState = await openclaw.saveConnectionPreset(params ?? {});
    applyRuntimeState(nextState);
    return nextState;
  }

  async function removeSavedConnection(savedConnectionId: string) {
    const openclaw = desktop?.openclaw;
    if (!openclaw?.removeSavedConnection) {
      return null;
    }

    const nextState = await openclaw.removeSavedConnection(savedConnectionId);
    applyRuntimeState(nextState);
    return nextState;
  }

  async function selectSavedConnection(savedConnectionId: string) {
    const openclaw = desktop?.openclaw;
    if (!openclaw?.selectSavedConnection) {
      return null;
    }

    const nextState = await openclaw.selectSavedConnection(savedConnectionId);
    applyRuntimeState(nextState);
    return nextState;
  }

  async function connectSavedConnection(savedConnectionId: string) {
    const savedConnection = savedConnections.find((entry) => entry.id === savedConnectionId) ?? null;
    if (!savedConnection) {
      throw new Error("未找到已保存的 OpenClaw 目标。");
    }

    const nextState = await selectSavedConnection(savedConnectionId);
    if (savedConnection.driver === "relay-paired" && !savedConnection.connectCode) {
      return nextState;
    }

    return connectOpenClaw({
      target: savedConnection.transport,
      profile: savedConnection.profile ?? undefined,
      stateDir: savedConnection.stateDir ?? undefined,
      driver: savedConnection.driver,
      sshTarget: savedConnection.sshTarget ?? undefined,
      sshPort: savedConnection.sshPort ?? undefined,
      endpointUrl: savedConnection.endpointUrl ?? undefined,
      accessToken: savedConnection.accessToken ?? undefined,
      relayUrl: savedConnection.relayUrl ?? undefined,
      connectCode: savedConnection.connectCode ?? undefined,
      label: savedConnection.label ?? savedConnection.name,
      agentId: savedConnection.agentId ?? undefined,
    });
  }

  async function createRelayConnectCode(params?: {
    relayUrl?: string;
    ttlMs?: number;
  }) {
    const openclaw = desktop?.openclaw;
    if (!openclaw?.createRelayConnectCode) {
      return null;
    }

    return openclaw.createRelayConnectCode({
      relayUrl: params?.relayUrl,
      ttlMs: params?.ttlMs,
    });
  }

  async function getRelayPairingState(params?: {
    relayUrl?: string;
    connectCode?: string;
  }) {
    const openclaw = desktop?.openclaw;
    if (!openclaw?.getRelayPairingState) {
      return null;
    }

    return openclaw.getRelayPairingState({
      relayUrl: params?.relayUrl,
      connectCode: params?.connectCode,
    });
  }

  async function approvePairingRequest(
    request: SabrinaOpenClawPairingStatus["requests"][number],
  ) {
    const openclaw = desktop?.openclaw;
    if (!openclaw?.approvePairingRequest) {
      return null;
    }

    const code = `${request?.code ?? ""}`.trim();
    if (!code) {
      throw new Error("当前配对请求缺少可批准的配对码。");
    }

    setApprovingPairingRequestId(request.requestId);

    try {
      const nextState = await openclaw.approvePairingRequest({
        code,
        channel: pairingStatus?.channel ?? undefined,
        accountId: request.accountId,
      });
      applyRuntimeState(nextState);
      return nextState;
    } finally {
      setApprovingPairingRequestId(null);
    }
  }

  async function approveLatestDeviceRequest() {
    const openclaw = desktop?.openclaw;
    if (!openclaw?.approveDeviceRequest) {
      return null;
    }

    setIsApprovingLatestDevice(true);

    try {
      const nextState = await openclaw.approveDeviceRequest({ latest: true });
      applyRuntimeState(nextState);
      return nextState;
    } finally {
      setIsApprovingLatestDevice(false);
    }
  }

  return {
    binding,
    connectionConfig,
    connectionState,
    bindingSetupState,
    modelState,
    skillCatalog,
    gatewayStatus,
    deviceStatus,
    pairingStatus,
    savedConnections,
    activeConnectionId,
    lastError,
    doctorReport,
    connectionProbe,
    supportSnapshot,
    selectedModel,
    modelOptions,
    turnJournalEntries,
    turnJournalStats,
    browserMemoryRecords,
    browserMemoryStats,
    isModelSwitching,
    approvingPairingRequestId,
    isApprovingLatestDevice,
    beginBindingSetup,
    connectOpenClaw,
    disconnectOpenClaw,
    doctorOpenClaw,
    probeConnection,
    createRelayConnectCode,
    getRelayPairingState,
    saveConnectionPreset,
    removeSavedConnection,
    selectSavedConnection,
    connectSavedConnection,
    setBindingTarget,
    switchSelectedModel,
    approvePairingRequest,
    approveLatestDeviceRequest,
    refreshOpenClawState,
  };
}
