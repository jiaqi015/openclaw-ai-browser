import {
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";

type SabrinaDesktop = NonNullable<Window["sabrinaDesktop"]>;
type SabrinaDesktopOpenClaw = NonNullable<SabrinaDesktop["openclaw"]>;
type SetRuntimeState = Dispatch<SetStateAction<SabrinaOpenClawState>>;

function isBrowserVisible() {
  if (typeof document === "undefined") {
    return true;
  }

  return document.visibilityState === "visible";
}

function getRuntimeSignature(state: SabrinaOpenClawState) {
  return JSON.stringify(state);
}

export function createEmptyOpenClawState(
  target: "local" | "remote" = "local",
): SabrinaOpenClawState {
  return {
    selectedTarget: target,
    connectionConfig: {
      enabled: false,
      transport: target,
      profile: null,
      stateDir: null,
    },
    connectionState: {
      status: target === "remote" ? "attention" : "disconnected",
      target,
      transport: target,
      profile: null,
      stateDir: null,
      bindingId: null,
      summary: target === "remote" ? "远程连接暂未开放" : "尚未连接本机 OpenClaw",
      detail: "",
      commandHint: "openclaw sabrina connect",
      doctorHint: "",
      transportLabel: "default",
      capabilities: [],
      lastCheckedAt: null,
      lastConnectedAt: null,
    },
    binding: null,
    bindingSetupState: {
      status: target === "remote" ? "degraded" : "idle",
      target,
      title: target === "remote" ? "连接远程龙虾" : "连接本机龙虾",
      description: "",
      note: "",
      steps: [],
    },
    modelState: null,
    skillCatalog: null,
    gatewayStatus: null,
    deviceStatus: null,
    pairingStatus: null,
    lastRefreshedAt: null,
    lastError: "",
  };
}

export function applyProjectedRuntimeState(
  setRuntimeState: SetRuntimeState,
  nextState: SabrinaOpenClawState | null | undefined,
) {
  if (!nextState) {
    return;
  }

  setRuntimeState((current) =>
    getRuntimeSignature(current) === getRuntimeSignature(nextState) ? current : nextState,
  );
}

async function hydrateOpenClawRuntime(
  openclaw: SabrinaDesktopOpenClaw,
  applyRuntimeState: (state: SabrinaOpenClawState | null | undefined) => void,
  options: {
    refresh?: boolean;
    target: "local" | "remote";
  },
) {
  const { refresh = false, target } = options;

  if (refresh && openclaw.refreshState) {
    applyRuntimeState(await openclaw.refreshState({ target }));
    return;
  }

  if (openclaw.getState) {
    applyRuntimeState(await openclaw.getState());
  }

  if (openclaw.refreshState) {
    applyRuntimeState(await openclaw.refreshState({ target }));
  }
}

export function useOpenClawRuntimeProjection({
  desktop,
  setRuntimeState,
  selectedBindingTargetRef,
}: {
  desktop?: SabrinaDesktop;
  setRuntimeState: SetRuntimeState;
  selectedBindingTargetRef: MutableRefObject<"local" | "remote">;
}) {
  useEffect(() => {
    const openclaw = desktop?.openclaw;
    if (!openclaw) {
      setRuntimeState(createEmptyOpenClawState("local"));
      return;
    }

    let mounted = true;

    function safeApplyRuntimeState(nextState: SabrinaOpenClawState | null | undefined) {
      if (!mounted) {
        return;
      }

      applyProjectedRuntimeState(setRuntimeState, nextState);
    }

    async function refreshRuntimeProjection(options?: {
      refresh?: boolean;
      target?: "local" | "remote";
    }) {
      try {
        await hydrateOpenClawRuntime(openclaw, safeApplyRuntimeState, {
          refresh: options?.refresh,
          target: options?.target ?? selectedBindingTargetRef.current,
        });
      } catch {
        // Keep the latest projected runtime state when refresh fails.
      }
    }

    void refreshRuntimeProjection();

    const unsubscribe = openclaw.onState?.((nextState) => {
      safeApplyRuntimeState(nextState);
    });

    function handleRuntimeWake() {
      if (!isBrowserVisible()) {
        return;
      }

      void refreshRuntimeProjection({
        refresh: true,
        target: selectedBindingTargetRef.current,
      }).catch(() => {});
    }

    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleRuntimeWake);
    }

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleRuntimeWake);
    }

    return () => {
      mounted = false;
      unsubscribe?.();
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", handleRuntimeWake);
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleRuntimeWake);
      }
    };
  }, [desktop, selectedBindingTargetRef, setRuntimeState]);
}
