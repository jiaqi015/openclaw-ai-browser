import { useEffect, useMemo, useState } from "react";

type SabrinaDesktop = NonNullable<Window["sabrinaDesktop"]>;

export function useBrowserState(desktop?: SabrinaDesktop) {
  const [browserState, setBrowserState] = useState<SabrinaDesktopSnapshot>({
    tabs: [],
    activeTabId: null,
  });
  const [libraryState, setLibraryState] = useState<SabrinaBrowserLibraryState>({
    history: [],
    bookmarks: [],
    downloads: [],
  });
  const [windowState, setWindowState] = useState<SabrinaDesktopWindowState>({
    isNormal: true,
    isMaximized: false,
    isFullScreen: false,
  });
  const [desktopUnavailable, setDesktopUnavailable] = useState(!desktop);

  useEffect(() => {
    if (!desktop) {
      setDesktopUnavailable(true);
      return;
    }

    let mounted = true;
    setDesktopUnavailable(false);

    desktop.getSnapshot().then((snapshot) => {
      if (mounted) {
        setBrowserState(snapshot);
      }
    });

    const unsubscribe = desktop.onStateChange((snapshot) => {
      if (mounted) {
        setBrowserState(snapshot);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [desktop]);

  useEffect(() => {
    if (!desktop?.getLibraryState) {
      return;
    }

    let mounted = true;

    desktop.getLibraryState().then((snapshot) => {
      if (mounted) {
        setLibraryState(snapshot);
      }
    });

    const unsubscribe = desktop.onLibraryStateChange?.((snapshot) => {
      if (mounted) {
        setLibraryState(snapshot);
      }
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [desktop]);

  useEffect(() => {
    if (!desktop?.getWindowState) {
      return;
    }

    let mounted = true;

    desktop.getWindowState().then((snapshot) => {
      if (mounted) {
        setWindowState(snapshot);
      }
    });

    const unsubscribe = desktop.onWindowStateChange?.((snapshot) => {
      if (mounted) {
        setWindowState(snapshot);
      }
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [desktop]);

  const activeTab = useMemo(
    () =>
      browserState.tabs.find((tab) => tab.tabId === browserState.activeTabId) ??
      browserState.tabs[0] ??
      null,
    [browserState],
  );

  const isMacDesktop =
    desktop?.shell === "electron" && desktop.platform === "darwin";
  const supportsNativeBrowserMenu = Boolean(desktop?.showBrowserMenu);

  return {
    tabs: browserState.tabs,
    activeTab,
    historyEntries: libraryState.history,
    bookmarkEntries: libraryState.bookmarks,
    downloads: libraryState.downloads,
    windowState,
    desktopUnavailable,
    isMacDesktop,
    supportsNativeBrowserMenu,
  };
}
