import { useEffect, useRef, useState } from "react";
import {
  applyProjectedRuntimeState,
  createEmptyOpenClawState,
  useOpenClawRuntimeProjection,
} from "./openclaw-runtime-projection";

type SabrinaDesktop = NonNullable<Window["sabrinaDesktop"]>;
type SabrinaDesktopOpenClaw = NonNullable<SabrinaDesktop["openclaw"]>;
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
  const lastError = runtimeState.lastError;
  const modelOptions = modelState?.models ?? [];
  const selectedModel = modelState?.desiredModel ?? modelState?.appliedModel ?? "";
  const turnJournalEntries = turnJournalSnapshot?.entries ?? [];
  const turnJournalStats = turnJournalSnapshot?.stats ?? null;
  const browserMemoryRecords = browserMemorySnapshot?.records ?? [];
  const browserMemoryStats = browserMemorySnapshot?.stats ?? null;

  useEffect(() => {
    const openclaw = desktop?.openclaw;
    if (!openclaw?.getTurnJournal || !openclaw?.searchMemory) {
      setTurnJournalSnapshot(null);
      setBrowserMemorySnapshot(null);
      return;
    }

    let mounted = true;

    Promise.all([
      openclaw.getTurnJournal({ limit: 3 }),
      openclaw.searchMemory({ query: "", limit: 3 }),
    ])
      .then(([journalSnapshot, memorySnapshot]) => {
        if (!mounted) {
          return;
        }

        setTurnJournalSnapshot(journalSnapshot);
        setBrowserMemorySnapshot(memorySnapshot);
      })
      .catch(() => {
        if (!mounted) {
          return;
        }

        setTurnJournalSnapshot(null);
        setBrowserMemorySnapshot(null);
      });

    return () => {
      mounted = false;
    };
  }, [desktop, runtimeState.lastRefreshedAt, runtimeState.selectedTarget]);

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
    driver?: "local-cli" | "ssh-cli" | "relay-paired";
    sshTarget?: string;
    sshPort?: number;
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
      ((params?.driver && params.driver !== "local-cli") || params?.sshTarget || params?.relayUrl
        ? "remote"
        : runtimeState.selectedTarget);
    const nextState = await openclaw.connect({
      target,
      profile: params?.profile,
      stateDir: params?.stateDir,
      driver: params?.driver,
      sshTarget: params?.sshTarget,
      sshPort: params?.sshPort,
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
    driver?: "local-cli" | "ssh-cli" | "relay-paired";
    sshTarget?: string;
    sshPort?: number;
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
        ((params?.driver && params.driver !== "local-cli") || params?.sshTarget
          || params?.relayUrl
          ? "remote"
          : runtimeState.selectedTarget),
      profile: params?.profile,
      stateDir: params?.stateDir,
      driver: params?.driver,
      sshTarget: params?.sshTarget,
      sshPort: params?.sshPort,
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
    driver?: "local-cli" | "ssh-cli" | "relay-paired";
    sshTarget?: string;
    sshPort?: number;
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
      relayUrl: params?.relayUrl,
      connectCode: params?.connectCode,
      label: params?.label,
      agentId: params?.agentId,
    });
    setDoctorReport(report);
    return report;
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
    lastError,
    doctorReport,
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
    createRelayConnectCode,
    getRelayPairingState,
    setBindingTarget,
    switchSelectedModel,
    approvePairingRequest,
    approveLatestDeviceRequest,
    refreshOpenClawState,
  };
}
