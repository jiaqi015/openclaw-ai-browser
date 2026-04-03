import { ipcMain } from "electron";
import {
  createBrowserTab,
  activateBrowserTab,
  closeBrowserTab,
  navigateActiveTab,
  goBack,
  goForward,
  reloadActiveTab,
  setBrowserBounds,
  setTabSelectedText,
  clearAllNavigationHistories,
  emitStateNow,
  defaultTabUrl,
  serializeState,
} from "../../runtime/browser/TabManager.mjs";
import {
  clearHistoryData,
  openDownloadRecord,
  removeBookmarkRecord,
  revealDownloadRecord,
  serializeLibraryState,
  toggleBookmarkRecord,
} from "../../runtime/browser/BrowserLibraryStore.mjs";
import {
  captureRendererEvent,
  getDiagnosticsState,
  openLogDirectory,
  revealHumanLogFile,
} from "./monitoring.mjs";
import { openExternalUrl } from "./RuntimeHostSupport.mjs";
import {
  closeBrowserMenuWindow,
  showBrowserMenuPopup,
} from "./BrowserMenuController.mjs";
import { setCurrentUiLocale } from "../../shared/localization.mjs";

export function registerBrowserIpcHandlers(getMainWindow) {
  ipcMain.handle("browser:get-snapshot", () => serializeState());
  ipcMain.handle("browser:get-library-state", () => serializeLibraryState());
  ipcMain.handle("browser:create-tab", (_e, payload) =>
    createBrowserTab(payload?.input ?? defaultTabUrl, { activate: true }),
  );
  ipcMain.handle("browser:activate-tab", (_e, payload) =>
    activateBrowserTab(`${payload?.tabId ?? ""}`),
  );
  ipcMain.handle("browser:close-tab", (_e, payload) =>
    closeBrowserTab(`${payload?.tabId ?? ""}`),
  );
  ipcMain.handle("browser:navigate", (_e, payload) =>
    navigateActiveTab(`${payload?.input ?? ""}`),
  );
  ipcMain.handle("browser:go-back", () => goBack());
  ipcMain.handle("browser:go-forward", () => goForward());
  ipcMain.handle("browser:reload", () => reloadActiveTab());
  ipcMain.handle("browser:set-bounds", (_e, payload) => setBrowserBounds(payload));
  ipcMain.handle("browser:set-ui-locale", (_e, payload) =>
    setCurrentUiLocale(`${payload?.locale ?? ""}`),
  );
  ipcMain.handle("browser:show-menu", (_e, payload) =>
    showBrowserMenuPopup(getMainWindow(), payload),
  );
  ipcMain.handle("browser:open-external", (_e, payload) => {
    const url = `${payload?.url ?? ""}`.trim();
    if (url) {
      openExternalUrl(url);
    }
  });
  ipcMain.handle("browser:toggle-bookmark", (_e, payload) =>
    toggleBookmarkRecord(payload ?? {}),
  );
  ipcMain.handle("browser:remove-bookmark", (_e, payload) =>
    removeBookmarkRecord(payload ?? {}),
  );
  ipcMain.handle("browser:clear-history", () => {
    clearAllNavigationHistories();
    emitStateNow();
    return clearHistoryData();
  });
  ipcMain.handle("browser:open-download", (_e, payload) =>
    openDownloadRecord(payload ?? {}),
  );
  ipcMain.handle("browser:reveal-download", (_e, payload) =>
    revealDownloadRecord(payload ?? {}),
  );
  ipcMain.handle("window:get-state", () => {
    const win = getMainWindow();
    if (!win) {
      return { isNormal: true, isMaximized: false, isFullScreen: false };
    }
    return {
      isNormal: win.isNormal(),
      isMaximized: win.isMaximized(),
      isFullScreen: win.isFullScreen(),
      isSimpleFullScreen:
        typeof win.isSimpleFullScreen === "function" ? win.isSimpleFullScreen() : false,
    };
  });
  ipcMain.handle("monitor:get-state", (_e, payload) =>
    getDiagnosticsState({
      entryLimit: Number(payload?.entryLimit) || undefined,
      networkLimit: Number(payload?.networkLimit) || undefined,
    }),
  );
  ipcMain.handle("monitor:open-log-directory", () => openLogDirectory());
  ipcMain.handle("monitor:reveal-human-log-file", () => revealHumanLogFile());
  ipcMain.handle("monitor:report-renderer-event", (_e, payload) =>
    captureRendererEvent(payload ?? {}),
  );
  ipcMain.on("guest:selection-change", (event, payload) => {
    setTabSelectedText(event.sender.id, payload?.text ?? "");
  });
  ipcMain.on("browser:menu-command", (_e, command) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send("browser:menu-command", command);
    }
    closeBrowserMenuWindow();
  });
  ipcMain.on("browser:menu-close", () => {
    closeBrowserMenuWindow();
  });
}
