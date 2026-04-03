export function getSabrinaDesktop() {
  return window.sabrinaDesktop;
}

export function getSabrinaMonitor() {
  return getSabrinaDesktop()?.monitor;
}

export function reportRendererEvent(payload: {
  level?: "error" | "warn" | "info";
  scope?: string;
  message: string;
  details?: unknown;
  tabId?: string;
  url?: string;
  kind?: string;
}) {
  return getSabrinaMonitor()?.reportRendererEvent(payload);
}

export function openMonitorLogDirectory() {
  return getSabrinaMonitor()?.openLogDirectory();
}

export function revealMonitorHumanLogFile() {
  return getSabrinaMonitor()?.revealHumanLogFile();
}
