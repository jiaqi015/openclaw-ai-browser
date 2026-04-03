import type { BrowserMenuCommand } from "../application/browser-surface";
type SabrinaDesktop = NonNullable<Window["sabrinaDesktop"]>;

export function useBrowserCommands(params: {
  desktop?: SabrinaDesktop;
  activeTab: SabrinaDesktopTab | null;
  refreshDiagnostics: () => Promise<void>;
}) {
  const { activeTab, desktop, refreshDiagnostics } = params;

  async function createTab(input?: string) {
    if (!desktop) {
      return;
    }
    return await desktop.createTab(input);
  }

  async function activateTab(tabId: string) {
    if (!desktop) {
      return;
    }
    await desktop.activateTab(tabId);
  }

  async function closeTab(tabId: string) {
    if (!desktop) {
      return;
    }
    await desktop.closeTab(tabId);
  }

  async function navigateCurrentTab(input: string) {
    if (!desktop || !input.trim()) {
      return;
    }
    await desktop.navigate(input);
  }

  async function goBack() {
    if (!desktop) {
      return;
    }
    await desktop.goBack();
  }

  async function goForward() {
    if (!desktop) {
      return;
    }
    await desktop.goForward();
  }

  async function reloadCurrentTab() {
    if (!desktop) {
      return;
    }
    await desktop.reload();
  }

  async function setBrowserBounds(bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) {
    if (!desktop) {
      return;
    }
    await desktop.setBrowserBounds(bounds);
  }

  async function openCurrentTabExternally() {
    if (!desktop || !activeTab?.url) {
      return;
    }
    await desktop.openExternal(activeTab.url);
  }

  function toggleBookmark() {
    if (!activeTab?.url || !desktop?.toggleBookmark) {
      return;
    }

    void desktop.toggleBookmark({
      url: activeTab.url,
      title: activeTab.title || activeTab.url,
    });
  }

  async function removeBookmark(url: string) {
    if (!desktop?.removeBookmark || !url.trim()) {
      return;
    }

    await desktop.removeBookmark(url);
  }

  async function clearHistory() {
    if (!desktop?.clearHistory) {
      return;
    }

    await desktop.clearHistory();
  }

  async function openDownload(downloadId: string) {
    if (!desktop?.openDownload || !downloadId.trim()) {
      return;
    }

    await desktop.openDownload(downloadId);
  }

  async function revealDownload(downloadId: string) {
    if (!desktop?.revealDownload || !downloadId.trim()) {
      return;
    }

    await desktop.revealDownload(downloadId);
  }

  async function showBrowserMenu(position: { x: number; y: number }) {
    if (!desktop?.showBrowserMenu) {
      return false;
    }

    return await desktop.showBrowserMenu(position);
  }

  async function openExternalUrl(url: string) {
    if (desktop?.openExternal) {
      await desktop.openExternal(url);
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function subscribeBrowserMenuCommand(listener: (command: BrowserMenuCommand) => void) {
    return desktop?.onBrowserMenuCommand?.(listener) ?? (() => {});
  }

  return {
    createTab,
    activateTab,
    closeTab,
    navigateCurrentTab,
    goBack,
    goForward,
    reloadCurrentTab,
    setBrowserBounds,
    openCurrentTabExternally,
    toggleBookmark,
    removeBookmark,
    clearHistory,
    openDownload,
    revealDownload,
    refreshDiagnostics,
    showBrowserMenu,
    openExternalUrl,
    subscribeBrowserMenuCommand,
  };
}
