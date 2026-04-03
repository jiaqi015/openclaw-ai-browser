// Native browser menu popup window.
import { BrowserWindow } from "electron";
import { getCurrentUiLocale, getSurfaceTitle, translate } from "../../shared/localization.mjs";

/** @type {BrowserWindow | null} */
let browserMenuWindow = null;

const MENU_ICONS = {
  history: createSystemEntryIconSvg("history"),
  bookmarks: createSystemEntryIconSvg("bookmarks"),
  downloads: createSystemEntryIconSvg("downloads"),
  diagnostics: createSystemEntryIconSvg("diagnostics"),
  "clear-history": createSystemEntryIconSvg("clear-history"),
  "general-settings": createSystemEntryIconSvg("general-settings"),
  settings: createSystemEntryIconSvg("settings"),
  "download-latest": createSystemEntryIconSvg("download-latest"),
};

export function closeBrowserMenuWindow() {
  if (!browserMenuWindow || browserMenuWindow.isDestroyed()) {
    browserMenuWindow = null;
    return;
  }
  browserMenuWindow.close();
  browserMenuWindow = null;
}

export function showBrowserMenuPopup(mainWindow, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return false;

  closeBrowserMenuWindow();

  const menuWidth = 176;
  const menuHeight = 298;
  const contentBounds = mainWindow.getContentBounds();
  const x = Math.min(
    contentBounds.x + contentBounds.width - menuWidth - 8,
    Math.max(contentBounds.x + 8, contentBounds.x + Math.round(payload?.x ?? 0)),
  );
  const y = Math.min(
    contentBounds.y + contentBounds.height - menuHeight - 8,
    Math.max(contentBounds.y + 8, contentBounds.y + Math.round(payload?.y ?? 0)),
  );

  browserMenuWindow = new BrowserWindow({
    parent: mainWindow,
    x,
    y,
    width: menuWidth,
    height: menuHeight,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: false,
    },
  });

  browserMenuWindow.setAlwaysOnTop(true, "pop-up-menu");
  browserMenuWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  browserMenuWindow.on("closed", () => {
    browserMenuWindow = null;
  });

  browserMenuWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(getBrowserMenuHtml())}`,
  );
  browserMenuWindow.once("ready-to-show", () => {
    browserMenuWindow?.show();
    browserMenuWindow?.focus();
  });

  return true;
}

function getBrowserMenuHtml() {
  const locale = getCurrentUiLocale();

  return String.raw`<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Browser Menu</title>
    <style>
      :root { color-scheme: dark; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "PingFang SC", "Helvetica Neue", sans-serif; }
      * { box-sizing: border-box; user-select: none; }
      html, body { margin: 0; width: 100%; height: 100%; background: transparent; overflow: hidden; }
      .panel { width: 100%; height: 100%; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.10); background: rgba(10,10,10,0.92); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); box-shadow: 0 24px 64px rgba(0,0,0,0.42); padding: 6px 0; }
      .separator { height: 1px; margin: 6px 8px; background: rgba(255,255,255,0.10); }
      .item { appearance: none; width: 100%; border: 0; background: transparent; color: rgba(255,255,255,0.82); display: flex; align-items: center; gap: 10px; padding: 8px 16px; font-size: 12px; font-weight: 500; line-height: 1; text-align: left; cursor: default; }
      .item:hover { background: rgba(255,255,255,0.10); color: #ffffff; }
      .item.danger { color: #ff6b7d; }
      .item.danger:hover { color: #ff8291; }
      .item.accent { color: #4da3ff; }
      .item.accent:hover { color: #78b8ff; }
      .icon { width: 21px; height: 21px; flex: none; }
      .icon svg { display: block; width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <div class="panel">
      <button class="item" data-command="history"><span class="icon">${MENU_ICONS.history}</span><span>${getSurfaceTitle("history", locale)}</span></button>
      <button class="item" data-command="bookmarks"><span class="icon">${MENU_ICONS.bookmarks}</span><span>${getSurfaceTitle("bookmarks", locale)}</span></button>
      <button class="item" data-command="downloads"><span class="icon">${MENU_ICONS.downloads}</span><span>${getSurfaceTitle("downloads", locale)}</span></button>
      <button class="item" data-command="diagnostics"><span class="icon">${MENU_ICONS.diagnostics}</span><span>${getSurfaceTitle("diagnostics", locale)}</span></button>
      <div class="separator"></div>
      <button class="item danger" data-command="clear-history"><span class="icon">${MENU_ICONS["clear-history"]}</span><span>${translate(locale, "menu.clearHistory")}</span></button>
      <div class="separator"></div>
      <button class="item" data-command="general-settings"><span class="icon">${MENU_ICONS["general-settings"]}</span><span>${getSurfaceTitle("general-settings", locale)}</span></button>
      <button class="item" data-command="settings"><span class="icon">${MENU_ICONS.settings}</span><span>${getSurfaceTitle("settings", locale)}</span></button>
      <div class="separator"></div>
      <button class="item accent" data-command="download-latest"><span class="icon">${MENU_ICONS["download-latest"]}</span><span>${translate(locale, "menu.downloadLatest")}</span></button>
    </div>
    <script>
      const { ipcRenderer } = require("electron");
      document.querySelectorAll("[data-command]").forEach((button) => {
        button.addEventListener("click", () => {
          ipcRenderer.send("browser:menu-command", button.dataset.command);
        });
      });
      window.addEventListener("blur", () => { ipcRenderer.send("browser:menu-close"); });
      window.addEventListener("keydown", (event) => {
        if (event.key === "Escape") { ipcRenderer.send("browser:menu-close"); }
      });
    </script>
  </body>
</html>`;
}

function createSystemEntryIconSvg(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(12 12) scale(1.18) translate(-12 -12)">
      ${getSystemEntryGlyphSvg(name)}
    </g>
  </svg>`;
}

function getSystemEntryGlyphSvg(name) {
  const stroke = "#F5F7FB";

  if (name === "history") {
    return `<path d="M8.7 10.25A4.15 4.15 0 1 1 8.55 14" stroke="${stroke}" stroke-width="1.45" stroke-linecap="round"/><path d="M8.7 8.75V10.8H6.6" stroke="${stroke}" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 10.45V12.7L13.7 13.75" stroke="${stroke}" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  if (name === "bookmarks") {
    return `<path d="M9.25 8.55H14.75C15.2471 8.55 15.65 8.95294 15.65 9.45V16.15L12 13.95L8.35 16.15V9.45C8.35 8.95294 8.75294 8.55 9.25 8.55Z" stroke="${stroke}" stroke-width="1.45" stroke-linejoin="round"/>`;
  }

  if (name === "downloads") {
    return `<path d="M12 8.7V13.65" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round"/><path d="M9.95 11.7L12 13.75L14.05 11.7" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.8 15.4V16C8.8 16.6075 9.29249 17.1 9.9 17.1H14.1C14.7075 17.1 15.2 16.6075 15.2 16V15.4" stroke="${stroke}" stroke-width="1.45" stroke-linecap="round"/>`;
  }

  if (name === "diagnostics") {
    return `<path d="M8.1 13.35H9.8L11.05 10.55L12.45 15.15L13.75 12.45H15.9" stroke="${stroke}" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  if (name === "general-settings") {
    return `<path d="M8.2 10H15.8" stroke="${stroke}" stroke-width="1.45" stroke-linecap="round"/><path d="M8.2 14.45H15.8" stroke="${stroke}" stroke-width="1.45" stroke-linecap="round"/><circle cx="10.25" cy="10" r="1.15" fill="${stroke}"/><circle cx="13.95" cy="14.45" r="1.15" fill="${stroke}"/>`;
  }

  if (name === "settings") {
    return `<path d="M10.25 9.25L9.35 8.05" stroke="${stroke}" stroke-width="1.25" stroke-linecap="round"/><path d="M13.75 9.25L14.65 8.05" stroke="${stroke}" stroke-width="1.25" stroke-linecap="round"/><path d="M12 9.1C10.5098 9.1 9.3 10.2872 9.3 11.75V12.7C9.3 14.1018 10.2482 15.1716 11.575 15.4711V16.85H12.425V15.4711C13.7518 15.1716 14.7 14.1018 14.7 12.7V11.75C14.7 10.2872 13.4902 9.1 12 9.1Z" stroke="${stroke}" stroke-width="1.35" stroke-linejoin="round"/><path d="M10.55 12.15H13.45" stroke="${stroke}" stroke-width="1.25" stroke-linecap="round"/><path d="M10.85 13.55H13.15" stroke="${stroke}" stroke-width="1.25" stroke-linecap="round"/>`;
  }

  if (name === "clear-history") {
    return `<path d="M8.5 9.15H15.5" stroke="${stroke}" stroke-width="1.45" stroke-linecap="round"/><path d="M10 9.15V8.55C10 8.13579 10.3358 7.8 10.75 7.8H13.25C13.6642 7.8 14 8.13579 14 8.55V9.15" stroke="${stroke}" stroke-width="1.35" stroke-linecap="round"/><path d="M9.25 10.2L9.7 15.7C9.75201 16.3357 10.2826 16.825 10.9204 16.825H13.0796C13.7174 16.825 14.248 16.3357 14.3 15.7L14.75 10.2" stroke="${stroke}" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/><path d="M11.1 11.35V14.75" stroke="${stroke}" stroke-width="1.25" stroke-linecap="round"/><path d="M12.9 11.35V14.75" stroke="${stroke}" stroke-width="1.25" stroke-linecap="round"/>`;
  }

  if (name === "download-latest") {
    return `<path d="M12 15.15V9.45" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round"/><path d="M9.95 11.45L12 9.4L14.05 11.45" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.9 16.45H15.1" stroke="${stroke}" stroke-width="1.45" stroke-linecap="round"/>`;
  }

  return "";
}
