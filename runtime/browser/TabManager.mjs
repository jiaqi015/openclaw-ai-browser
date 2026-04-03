// Owns all browser tab lifecycle: create, activate, close, navigate, bounds.
import { bindBrowserTabEvents } from "./BrowserTabEventBinding.mjs";
import {
  defaultTabUrl,
  getBrowserTabContextSource,
  maxSelectionChars,
  normalizeBrowserAddressInput,
  serializeBrowserTab,
} from "./BrowserTabStateSupport.mjs";

const startupTabUrls = [
  "https://music.apple.com",
  "https://www.bing.com",
  "https://www.nytimes.com",
];

let mainWindowGetter = () => null;
let createGuestView = createMissingGuestView;
let bindGuestContents = () => {};
let openExternalUrl = () => {};
let recordEvent = () => {};

/** @type {Map<string, object>} */
const browserTabs = new Map();
/** @type {Map<number, string>} */
const webContentsToTabId = new Map();
const browserStateListeners = new Set();
let attachedView = null;
let activeTabId = null;
let nextTabIndex = 1;
let browserBounds = { x: 0, y: 0, width: 0, height: 0 };
let emitStateTimer = null;

export { defaultTabUrl, maxSelectionChars };

function createMissingGuestView() {
  throw new Error("TabManager host support has not been initialized.");
}

function mapWebContentsToTabId(webContentsId, tabId) {
  webContentsToTabId.set(webContentsId, tabId);
}

function unmapWebContentsId(webContentsId) {
  webContentsToTabId.delete(webContentsId);
}

function getActiveTab() {
  return activeTabId ? browserTabs.get(activeTabId) ?? null : null;
}

function getTabById(tabId) {
  if (!tabId) {
    return null;
  }

  return browserTabs.get(tabId) ?? null;
}

function syncNavigationState(tab) {
  const { navigationHistory } = tab.view.webContents;
  tab.canGoBack = navigationHistory.canGoBack();
  tab.canGoForward = navigationHistory.canGoForward();
  tab.loading = tab.view.webContents.isLoading();
}

function attachActiveTabView() {
  const win = mainWindowGetter();
  if (!win) {
    return;
  }

  const tab = getActiveTab();
  if (!tab) {
    if (attachedView) {
      win.contentView.removeChildView(attachedView);
      attachedView = null;
    }
    return;
  }

  if (attachedView && attachedView !== tab.view) {
    attachedView.setVisible(false);
    win.contentView.removeChildView(attachedView);
  }

  attachedView = tab.view;
  win.contentView.addChildView(tab.view);
  tab.view.setVisible(true);
  applyBrowserBounds();
  tab.view.webContents.focus();
}

function bindTab(tab) {
  bindBrowserTabEvents(tab, {
    bindGuestContents,
    openExternalUrl,
    recordEvent,
    createBrowserTab,
    syncNavigationState,
    emitState,
    mapWebContentsToTabId,
    unmapWebContentsId,
  });
}

function loadTabUrl(tab, url) {
  const isInternalGenTab = url.startsWith("sabrina://gentab/");
  if (isInternalGenTab) {
    tab.loading = false;
    return;
  }

  tab.view.webContents.loadURL(url).catch((error) => {
    tab.lastError = error instanceof Error ? error.message : String(error);
    tab.loading = false;
    emitStateNow();
  });
}

function notifyBrowserState(snapshot) {
  for (const listener of browserStateListeners) {
    try {
      listener(snapshot);
    } catch {
    }
  }
}

export function initTabManager(options = {}) {
  mainWindowGetter =
    typeof options.getMainWindow === "function" ? options.getMainWindow : () => null;
  createGuestView =
    typeof options.createGuestView === "function"
      ? options.createGuestView
      : createMissingGuestView;
  bindGuestContents =
    typeof options.bindGuestContents === "function" ? options.bindGuestContents : () => {};
  openExternalUrl =
    typeof options.openExternalUrl === "function" ? options.openExternalUrl : () => {};
  recordEvent = typeof options.recordEvent === "function" ? options.recordEvent : () => {};
}

export function resetTabManagerState() {
  // Drop all runtime tab references when the window closes so next activation
  // starts from a clean browser kernel state.
  browserTabs.clear();
  webContentsToTabId.clear();
  attachedView = null;
  activeTabId = null;
  nextTabIndex = 1;
}

export function getTabIdByWebContentsId(webContentsId) {
  return webContentsToTabId.get(webContentsId) ?? null;
}

export function getActiveTabId() {
  return activeTabId;
}

export function getTabContextSource(tabId = null) {
  const tab = tabId ? getTabById(tabId) : getActiveTab();
  return getBrowserTabContextSource(tab);
}

export function findBrowserTabIdByUrl(url) {
  const targetUrl = `${url ?? ""}`.trim();
  if (!targetUrl) {
    return null;
  }

  for (const [tabId, tab] of browserTabs) {
    if (tab.url === targetUrl) {
      return tabId;
    }
  }

  return null;
}

export function serializeState() {
  return {
    tabs: [...browserTabs.values()].map((tab) => serializeBrowserTab(tab)),
    activeTabId,
  };
}

export function subscribeBrowserState(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }

  browserStateListeners.add(listener);
  return () => {
    browserStateListeners.delete(listener);
  };
}

export function emitState() {
  if (emitStateTimer) {
    return;
  }

  emitStateTimer = setTimeout(() => {
    emitStateTimer = null;
    const snapshot = serializeState();
    notifyBrowserState(snapshot);
    const win = mainWindowGetter();
    if (!win || win.isDestroyed()) {
      return;
    }
    win.webContents.send("browser:state", snapshot);
  }, 30);
}

export function emitStateNow() {
  if (emitStateTimer) {
    clearTimeout(emitStateTimer);
    emitStateTimer = null;
  }

  const snapshot = serializeState();
  notifyBrowserState(snapshot);
  const win = mainWindowGetter();
  if (!win || win.isDestroyed()) {
    return;
  }
  win.webContents.send("browser:state", snapshot);
}

export function getDiagnosticsTabSnapshot() {
  const tab = getActiveTab();
  return { tabCount: browserTabs.size, activeTabId, activeTabUrl: tab?.url ?? "" };
}

export function applyBrowserBounds() {
  const tab = getActiveTab();
  if (!tab) {
    return;
  }

  if (browserBounds.width <= 0 || browserBounds.height <= 0) {
    tab.view.setVisible(false);
    tab.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    return;
  }

  tab.view.setVisible(true);
  tab.view.setBounds(browserBounds);
  tab.view.setBorderRadius(0);
}

export function createBrowserTab(initialInput = defaultTabUrl, options = {}) {
  const { activate = true } = options;
  const tabId = `tab-${nextTabIndex++}`;
  const normalized = normalizeBrowserAddressInput(initialInput);
  const view = createGuestView();

  view.setBackgroundColor("#050505");

  const tab = {
    tabId,
    view,
    title: "新标签页",
    url: normalized.url,
    loading: true,
    canGoBack: false,
    canGoForward: false,
    selectedText: "",
    favicon: null,
    lastError: null,
  };

  bindTab(tab);
  browserTabs.set(tabId, tab);
  recordEvent("info", "browser", "创建标签页", {
    source: "main",
    tabId,
    url: normalized.url,
    details: { activate },
  });

  if (activate) {
    activeTabId = tabId;
    attachActiveTabView();
  }

  loadTabUrl(tab, normalized.url);
  emitStateNow();
  return serializeBrowserTab(tab);
}

export function createStartupTabs() {
  createBrowserTab(startupTabUrls[0], { activate: true });
  for (const url of startupTabUrls.slice(1)) {
    createBrowserTab(url, { activate: false });
  }
}

export function activateBrowserTab(tabId) {
  if (!browserTabs.has(tabId)) {
    return serializeState();
  }

  activeTabId = tabId;
  attachActiveTabView();
  emitStateNow();
  return serializeState();
}

export function closeBrowserTab(tabId) {
  const tab = browserTabs.get(tabId);
  if (!tab) {
    return serializeState();
  }

  recordEvent("info", "browser", "关闭标签页", {
    source: "main",
    tabId,
    url: tab.url,
  });

  const tabIds = [...browserTabs.keys()];
  const closingIndex = tabIds.indexOf(tabId);
  const fallbackTabId = tabIds[closingIndex + 1] ?? tabIds[closingIndex - 1] ?? null;

  if (attachedView === tab.view) {
    const win = mainWindowGetter();
    if (win) {
      win.contentView.removeChildView(tab.view);
    }
    attachedView = null;
  }

  browserTabs.delete(tabId);
  webContentsToTabId.delete(tab.view.webContents.id);
  tab.view.webContents.close({ waitForBeforeUnload: false });

  if (browserTabs.size === 0) {
    createBrowserTab(defaultTabUrl, { activate: true });
    return serializeState();
  }

  if (activeTabId === tabId && fallbackTabId) {
    activeTabId = fallbackTabId;
    attachActiveTabView();
  }

  emitStateNow();
  return serializeState();
}

export function navigateActiveTab(input) {
  const tab = getActiveTab();
  if (!tab) {
    return serializeState();
  }

  const normalized = normalizeBrowserAddressInput(input);
  tab.selectedText = "";
  tab.lastError = null;
  tab.loading = true;
  recordEvent("info", "browser", "发起导航", {
    source: "main",
    tabId: tab.tabId,
    url: normalized.url,
    details: { input },
  });
  emitStateNow();

  loadTabUrl(tab, normalized.url);
  return serializeState();
}

export function goBack() {
  const tab = getActiveTab();
  if (!tab || !tab.view.webContents.navigationHistory.canGoBack()) {
    return serializeState();
  }

  tab.view.webContents.navigationHistory.goBack();
  return serializeState();
}

export function goForward() {
  const tab = getActiveTab();
  if (!tab || !tab.view.webContents.navigationHistory.canGoForward()) {
    return serializeState();
  }

  tab.view.webContents.navigationHistory.goForward();
  return serializeState();
}

export function reloadActiveTab() {
  const tab = getActiveTab();
  if (!tab) {
    return serializeState();
  }

  tab.selectedText = "";
  recordEvent("info", "browser", "刷新标签页", {
    source: "main",
    tabId: tab.tabId,
    url: tab.url,
  });
  tab.view.webContents.reload();
  return serializeState();
}

export function setBrowserBounds(bounds) {
  browserBounds = {
    x: Math.max(0, Math.round(bounds?.x ?? 0)),
    y: Math.max(0, Math.round(bounds?.y ?? 0)),
    width: Math.max(0, Math.round(bounds?.width ?? 0)),
    height: Math.max(0, Math.round(bounds?.height ?? 0)),
  };
  applyBrowserBounds();
  return browserBounds;
}

// Called when history is cleared so webContents nav stacks are also wiped.
export function clearAllNavigationHistories() {
  for (const tab of browserTabs.values()) {
    tab.view.webContents.navigationHistory.clear();
    const { navigationHistory } = tab.view.webContents;
    tab.canGoBack = navigationHistory.canGoBack();
    tab.canGoForward = navigationHistory.canGoForward();
  }
}

export function setTabSelectedText(webContentsId, text) {
  const tabId = webContentsToTabId.get(webContentsId);
  if (!tabId) {
    return;
  }

  const tab = browserTabs.get(tabId);
  if (!tab) {
    return;
  }

  const next = `${text ?? ""}`.trim().slice(0, maxSelectionChars);
  if (tab.selectedText === next) {
    return;
  }

  tab.selectedText = next;
  emitState();
}
