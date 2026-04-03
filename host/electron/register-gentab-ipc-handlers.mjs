import { ipcMain } from "electron";
import {
  closeBrowserTab,
  createBrowserTab,
  findBrowserTabIdByUrl,
} from "../../runtime/browser/TabManager.mjs";
import { generateGenTab } from "./GenTabIpcActionService.mjs";

export function registerGentabIpcHandlers(getMainWindow) {
  ipcMain.handle("gentab:create", async (_e, payload) => {
    const genId = `${payload?.genId ?? ""}`.trim();
    const referenceTabIds = normalizeReferenceTabIds(payload?.referenceTabIds);
    const userIntent = payload?.userIntent;
    const preferredType = payload?.preferredType;

    if (!genId) {
      return { success: false, error: "缺少 GenTab id" };
    }

    const url = `sabrina://gentab/${genId}`;
    const tab = createBrowserTab(url, { activate: true });
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send("gentab:create-pending", {
        genId,
        referenceTabIds,
        userIntent,
        preferredType,
      });
    }
    return { success: true, tab };
  });

  ipcMain.handle("gentab:generate", async (_e, payload) => {
    return generateGenTab(payload ?? {});
  });

  ipcMain.handle("gentab:close", (_e, payload) => {
    const genId = `${payload?.genId ?? ""}`.trim();
    if (!genId) {
      return { success: false, error: "缺少 GenTab id" };
    }
    const tabId = findGenTabIdByGenId(genId);
    if (tabId) {
      closeBrowserTab(tabId);
    }
    return { success: true };
  });

  ipcMain.on("gentab:generation-completed", (_e, payload) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send("gentab:generation-completed", {
        genId: `${payload?.genId ?? ""}`.trim(),
      });
    }
  });
}

function normalizeReferenceTabIds(value) {
  return Array.isArray(value)
    ? value.map((tabId) => `${tabId ?? ""}`.trim()).filter(Boolean)
    : [];
}

function findGenTabIdByGenId(genId) {
  return findBrowserTabIdByUrl(`sabrina://gentab/${genId}`);
}
