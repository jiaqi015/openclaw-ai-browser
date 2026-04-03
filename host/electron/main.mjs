// App entry point — startup, window creation, and lifecycle only.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, nativeImage, session } from "electron";
import {
  initializeMonitoring,
  bindRendererWindowContents,
  recordMonitorEvent,
} from "./monitoring.mjs";
import {
  openLocalFilePath,
  openExternalUrl,
  resolveUserDataFilePath,
  revealLocalFilePath,
} from "./RuntimeHostSupport.mjs";
import {
  bindBrowserGuestContents,
  createBrowserGuestView,
} from "./BrowserGuestViewHostSupport.mjs";
import {
  initTabManager,
  createStartupTabs,
  emitState,
  emitStateNow,
  applyBrowserBounds,
  getDiagnosticsTabSnapshot,
  getTabIdByWebContentsId,
  resetTabManagerState,
  subscribeBrowserState,
} from "../../runtime/browser/TabManager.mjs";
import {
  initLibraryStore,
  loadBrowserLibraryState,
  bindDownloadTracking,
  serializeLibraryState,
} from "../../runtime/browser/BrowserLibraryStore.mjs";
import {
  initThreadStore,
  loadThreadStoreState,
  serializeThreadRuntimeState,
} from "../../runtime/threads/ThreadStore.mjs";
import { initThreadBindingCoordinator } from "../../runtime/threads/ThreadBindingCoordinator.mjs";
import {
  initOpenClawTaskStore,
  loadOpenClawTaskState,
  serializeOpenClawTaskState,
} from "../../runtime/openclaw/OpenClawTaskStore.mjs";
import {
  initOpenClawStateStore,
  loadOpenClawStateStore,
  refreshOpenClawState,
  serializeOpenClawState,
} from "../../runtime/openclaw/OpenClawStateStore.mjs";
import { closeBrowserMenuWindow } from "./BrowserMenuController.mjs";
import { registerIpcHandlers } from "./ipc-handlers.mjs";
import {
  startSabrinaConnectorBridge,
  stopSabrinaConnectorBridge,
} from "./SabrinaConnectorBridge.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const rendererUrl = "http://127.0.0.1:3000";

/** @type {BrowserWindow | null} */
let mainWindow = null;

function getMainWindow() {
  return mainWindow;
}

function emitWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("window:state", {
    isNormal: mainWindow.isNormal(),
    isMaximized: mainWindow.isMaximized(),
    isFullScreen: mainWindow.isFullScreen(),
    isSimpleFullScreen:
      typeof mainWindow.isSimpleFullScreen === "function"
        ? mainWindow.isSimpleFullScreen()
        : false,
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1540,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    title: "OpenClaw Browser Sabrina",
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 18, y: 16 },
    backgroundColor: "#050505",
    vibrancy: "under-window",
    visualEffectState: "active",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  if (process.platform === "darwin") mainWindow.setWindowButtonVisibility(true);

  if (isDev) {
    mainWindow.loadURL(rendererUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  bindRendererWindowContents(mainWindow.webContents);
  recordMonitorEvent("info", "system", "主窗口已创建", { source: "main" });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("did-fail-load", (_e, errorCode, errorDescription, validatedURL) => {
    if (errorCode === -3) return;
    recordMonitorEvent("error", "renderer", "主渲染层加载失败", {
      source: "renderer",
      kind: "renderer-load-failure",
      details: { errorCode, errorDescription, validatedURL },
    });
  });

  mainWindow.on("resize", () => { closeBrowserMenuWindow(); applyBrowserBounds(); emitWindowState(); });
  mainWindow.on("move", () => closeBrowserMenuWindow());
  mainWindow.on("maximize", emitWindowState);
  mainWindow.on("unmaximize", emitWindowState);
  mainWindow.on("enter-full-screen", emitWindowState);
  mainWindow.on("leave-full-screen", emitWindowState);

  mainWindow.on("closed", () => {
    closeBrowserMenuWindow();
    resetTabManagerState();
    recordMonitorEvent("info", "system", "主窗口已关闭", { source: "main" });
    mainWindow = null;
  });

  mainWindow.webContents.on("did-finish-load", () => {
    emitStateNow();
    mainWindow?.webContents.send("browser:library-state", serializeLibraryState());
    mainWindow?.webContents.send("thread:runtime-state", serializeThreadRuntimeState());
    mainWindow?.webContents.send("openclaw:state", serializeOpenClawState());
    mainWindow?.webContents.send("openclaw:task-state", serializeOpenClawTaskState());
    emitWindowState();
  });
}

app.whenReady().then(async () => {
  if (process.platform === "darwin") {
    const dockIcon = nativeImage.createFromPath(path.join(process.cwd(), "build", "icon.png"));
    if (!dockIcon.isEmpty()) app.dock.setIcon(dockIcon);
  }

  initLibraryStore({
    getMainWindow,
    resolveStatePath: () => resolveUserDataFilePath("browser-library.json"),
    recordEvent: recordMonitorEvent,
    openPath: openLocalFilePath,
    revealPath: revealLocalFilePath,
  });
  initThreadStore({
    getMainWindow,
    resolveStatePath: () => resolveUserDataFilePath("thread-state.json"),
    recordEvent: recordMonitorEvent,
  });
  initThreadBindingCoordinator(subscribeBrowserState);
  initOpenClawStateStore({
    getMainWindow,
    resolveStatePath: () => resolveUserDataFilePath("openclaw-state.json"),
    recordEvent: recordMonitorEvent,
  });
  initOpenClawTaskStore({
    getMainWindow,
    resolveStatePath: () => resolveUserDataFilePath("openclaw-tasks.json"),
    recordEvent: recordMonitorEvent,
  });
  initTabManager({
    getMainWindow,
    createGuestView: createBrowserGuestView,
    bindGuestContents: bindBrowserGuestContents,
    openExternalUrl,
    recordEvent: recordMonitorEvent,
  });

  await initializeMonitoring({
    getMainWindow,
    resolveTabIdByWebContentsId: getTabIdByWebContentsId,
    getTabSnapshot: getDiagnosticsTabSnapshot,
    session: session.defaultSession,
  });

  await loadBrowserLibraryState();
  await loadThreadStoreState();
  await loadOpenClawStateStore();
  await loadOpenClawTaskState();
  bindDownloadTracking(session.defaultSession, getTabIdByWebContentsId);
  registerIpcHandlers(getMainWindow);
  await startSabrinaConnectorBridge({ recordEvent: recordMonitorEvent });
  createMainWindow();
  createStartupTabs();
  void refreshOpenClawState().catch(() => {});

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
      createStartupTabs();
    } else {
      BrowserWindow.getAllWindows()[0]?.show();
    }
  });
});

app.on("before-quit", () => {
  void stopSabrinaConnectorBridge().catch(() => {});
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
