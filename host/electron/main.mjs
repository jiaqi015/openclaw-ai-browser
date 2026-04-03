// App entry point — startup, window creation, and lifecycle only.
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
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
import {
  initTurnJournalStore,
  loadTurnJournalState,
} from "../../runtime/turns/TurnJournalStore.mjs";
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
const devRendererUrl = process.env.SABRINA_RENDERER_URL?.trim() || "http://127.0.0.1:3000";
const distRendererPath = path.join(__dirname, "../../dist/index.html");
const distRendererUrl = pathToFileURL(distRendererPath).toString();
const shouldPreferDistRenderer =
  app.isPackaged || process.env.SABRINA_RENDERER_SOURCE === "dist";

/** @type {BrowserWindow | null} */
let mainWindow = null;
let attemptedDistRendererFallback = false;

function getMainWindow() {
  return mainWindow;
}

function escapeHtml(value) {
  return `${value ?? ""}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildRendererFailurePage(payload) {
  const commands = shouldPreferDistRenderer
    ? [
        "npm run build",
        "npm run electron:start",
      ]
    : [
        "npm run dev",
        "npm run electron:start",
      ];

  const hint = shouldPreferDistRenderer
    ? "当前处于本地桌面启动模式，Sabrina 会优先读取 dist。"
    : existsSync(distRendererPath)
      ? "未能连上本地 Vite，已尝试回退到 dist。"
      : "当前既没有可用的 Vite，也没有可回退的 dist。";

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sabrina Renderer Load Failed</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", sans-serif;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at top, rgba(255,255,255,0.08), transparent 24%),
          linear-gradient(180deg, #0f1115 0%, #050607 100%);
        color: #f4f7fb;
      }
      .panel {
        width: min(720px, calc(100vw - 48px));
        border-radius: 24px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(15, 17, 21, 0.84);
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.38);
        padding: 28px;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 28px;
      }
      p {
        margin: 0 0 12px;
        line-height: 1.6;
        color: rgba(244, 247, 251, 0.78);
      }
      code, pre {
        font-family: ui-monospace, "SF Mono", Menlo, monospace;
      }
      pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        padding: 14px 16px;
        border-radius: 16px;
        background: rgba(0, 0, 0, 0.32);
        border: 1px solid rgba(255,255,255,0.08);
      }
      .stack {
        display: grid;
        gap: 10px;
        margin-top: 18px;
      }
    </style>
  </head>
  <body>
    <main class="panel">
      <h1>Sabrina 没能加载界面</h1>
      <p>${escapeHtml(hint)}</p>
      <p>你可以优先尝试下面任一命令：</p>
      <pre>${commands.map((command) => `$ ${command}`).join("\n")}</pre>
      <div class="stack">
        <pre>错误: ${escapeHtml(payload?.errorDescription || "unknown")}</pre>
        <pre>地址: ${escapeHtml(payload?.validatedURL || "(empty)")}</pre>
      </div>
    </main>
  </body>
</html>`;
}

function loadRendererFailurePage(payload) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const html = buildRendererFailurePage(payload);
  const encoded = `data:text/html;charset=UTF-8,${encodeURIComponent(html)}`;
  void mainWindow.loadURL(encoded).catch(() => {});
}

function loadMainRenderer() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  attemptedDistRendererFallback = false;

  if (shouldPreferDistRenderer) {
    if (!existsSync(distRendererPath)) {
      loadRendererFailurePage({
        errorDescription: "dist/index.html 不存在",
        validatedURL: distRendererUrl,
      });
      return;
    }

    void mainWindow.loadFile(distRendererPath).catch((error) => {
      loadRendererFailurePage({
        errorDescription: error instanceof Error ? error.message : String(error),
        validatedURL: distRendererUrl,
      });
    });
    return;
  }

  void mainWindow.loadURL(devRendererUrl).catch(() => {});
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

  loadMainRenderer();

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

    if (
      !shouldPreferDistRenderer &&
      validatedURL === devRendererUrl &&
      !attemptedDistRendererFallback &&
      existsSync(distRendererPath)
    ) {
      attemptedDistRendererFallback = true;
      recordMonitorEvent("warn", "renderer", "本地 Vite 不可用，回退到 dist 渲染层", {
        source: "renderer",
        kind: "renderer-dist-fallback",
        details: { validatedURL, distRendererPath },
      });
      void mainWindow?.loadFile(distRendererPath).catch((error) => {
        loadRendererFailurePage({
          errorDescription: error instanceof Error ? error.message : String(error),
          validatedURL: distRendererUrl,
        });
      });
      return;
    }

    if (validatedURL === devRendererUrl || validatedURL === distRendererUrl) {
      loadRendererFailurePage({ errorDescription, validatedURL });
    }
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
  initTurnJournalStore({
    resolveStatePath: () => resolveUserDataFilePath("turn-journal.json"),
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
  await loadTurnJournalState();
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
