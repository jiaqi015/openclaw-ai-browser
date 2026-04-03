import { useEffect, useState } from "react";

type SabrinaDesktop = NonNullable<Window["sabrinaDesktop"]>;

const defaultDiagnosticsRequest = {
  entryLimit: 180,
  networkLimit: 60,
} as const;

export function useDesktopDiagnostics(desktop?: SabrinaDesktop) {
  const [diagnostics, setDiagnostics] = useState<SabrinaDiagnosticsState | null>(null);

  useEffect(() => {
    if (!desktop?.monitor) {
      return;
    }

    let mounted = true;

    desktop.monitor
      .getState(defaultDiagnosticsRequest)
      .then((snapshot) => {
        if (mounted) {
          setDiagnostics(snapshot);
        }
      });

    const unsubscribe = desktop.monitor.onState((snapshot) => {
      if (mounted) {
        setDiagnostics(snapshot);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [desktop]);

  async function refreshDiagnostics() {
    if (!desktop?.monitor) {
      return;
    }

    const snapshot = await desktop.monitor.getState(defaultDiagnosticsRequest);
    setDiagnostics(snapshot);
  }

  async function openLogDirectory() {
    if (!desktop?.monitor?.openLogDirectory) {
      return;
    }

    await desktop.monitor.openLogDirectory();
  }

  async function revealHumanLogFile() {
    if (!desktop?.monitor?.revealHumanLogFile) {
      return;
    }

    await desktop.monitor.revealHumanLogFile();
  }

  return {
    diagnostics,
    refreshDiagnostics,
    openLogDirectory,
    revealHumanLogFile,
  };
}
