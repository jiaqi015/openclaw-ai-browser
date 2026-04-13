import { ipcMain } from "electron";
import {
  clearPendingGenTabMetadata,
  getGenTabRuntimeState,
  setPendingGenTabMetadata,
} from "../../runtime/browser/GenTabStore.mjs";
import {
  closeBrowserTab,
  createBrowserTab,
  findBrowserTabIdByUrl,
  updateBrowserTabTitle,
} from "../../runtime/browser/TabManager.mjs";
import { generateGenTab, generateCodingGenTab, refreshGenTabItem } from "./GenTabIpcActionService.mjs";

export function registerGentabIpcHandlers(getMainWindow) {
  ipcMain.handle("gentab:get-state", (_e, payload) => {
    const genId = `${payload?.genId ?? ""}`.trim();
    if (!genId) {
      return { success: false, error: "缺少 GenTab id" };
    }

    return {
      success: true,
      ...getGenTabRuntimeState(genId),
    };
  });

  ipcMain.handle("gentab:set-pending", async (_e, payload) => {
    const genId = `${payload?.genId ?? ""}`.trim();
    if (!genId) {
      return { success: false, error: "缺少 GenTab id" };
    }

    const runtimeState = await setPendingGenTabMetadata(genId, {
      referenceTabIds: normalizeReferenceTabIds(payload?.referenceTabIds),
      userIntent: payload?.userIntent,
      preferredType: payload?.preferredType,
    });

    return {
      success: true,
      ...runtimeState,
    };
  });

  ipcMain.handle("gentab:create", async (_e, payload) => {
    const genId = `${payload?.genId ?? ""}`.trim();
    const referenceTabIds = normalizeReferenceTabIds(payload?.referenceTabIds);
    const userIntent = payload?.userIntent;
    const preferredType = payload?.preferredType;

    if (!genId) {
      return { success: false, error: "缺少 GenTab id" };
    }

    await setPendingGenTabMetadata(genId, {
      referenceTabIds,
      userIntent,
      preferredType,
    });

    try {
      const url = `sabrina://gentab/${genId}`;
      const tab = createBrowserTab(url, { activate: true });
      return { success: true, tab };
    } catch (error) {
      await clearPendingGenTabMetadata(genId);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("gentab:generate", async (_e, payload) => {
    return generateGenTab(payload ?? {});
  });

  ipcMain.handle("gentab:refresh-item", async (_e, payload) => {
    return refreshGenTabItem(payload ?? {});
  });

  ipcMain.handle("gentab:generate-coding", async (e, payload) => {
    const genId = `${payload?.genId ?? ""}`.trim();
    const sendProgress = (stage, label) => {
      try {
        if (!e.sender.isDestroyed()) {
          e.sender.send("gentab:coding-progress", { genId, stage, label });
        }
      } catch {}
    };
    const result = await generateCodingGenTab(payload ?? {}, { sendProgress });
    // After successful generation, update the browser tab's display title so it
    // shows the GenTab's human title in the tab strip instead of "gentab".
    if (result?.success && result.gentab?.title) {
      const tabId =
        findBrowserTabIdByUrl(`sabrina://gentab/${genId}?v=coding`) ??
        findBrowserTabIdByUrl(`sabrina://gentab/${genId}`);
      if (tabId) updateBrowserTabTitle(tabId, result.gentab.title);
    }
    return result;
  });

  // Create a coding GenTab tab — navigates to sabrina://gentab/<id>?v=coding
  ipcMain.handle("gentab:create-coding", async (_e, payload) => {
    const genId = `${payload?.genId ?? ""}`.trim();
    const referenceTabIds = normalizeReferenceTabIds(payload?.referenceTabIds);
    const userIntent = payload?.userIntent;

    if (!genId) return { success: false, error: "缺少 GenTab id" };

    await setPendingGenTabMetadata(genId, { referenceTabIds, userIntent, preferredType: "auto" });

    try {
      const url = `sabrina://gentab/${genId}?v=coding`;
      const tab = createBrowserTab(url, { activate: true });
      return { success: true, tab };
    } catch (error) {
      await clearPendingGenTabMetadata(genId);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("gentab:close", async (_e, payload) => {
    const genId = `${payload?.genId ?? ""}`.trim();
    if (!genId) {
      return { success: false, error: "缺少 GenTab id" };
    }
    await clearPendingGenTabMetadata(genId);
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
