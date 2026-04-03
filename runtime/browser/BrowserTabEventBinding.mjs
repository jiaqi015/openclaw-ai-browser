import {
  recordHistoryVisit,
  updateStoredEntryTitle,
} from "./BrowserLibraryStore.mjs";
import { getBrowserUrlLabel } from "./BrowserUrlService.mjs";

export function bindBrowserTabEvents(
  tab,
  {
    bindGuestContents = () => {},
    openExternalUrl = () => {},
    recordEvent = () => {},
    createBrowserTab = () => {},
    syncNavigationState = () => {},
    emitState = () => {},
    mapWebContentsToTabId = () => {},
    unmapWebContentsId = () => {},
  } = {},
) {
  const contents = tab.view.webContents;
  mapWebContentsToTabId(contents.id, tab.tabId);
  bindGuestContents(tab.tabId, contents);

  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) {
      recordEvent("info", "browser", "网页请求打开新窗口", {
        source: "guest",
        tabId: tab.tabId,
        url,
      });
      createBrowserTab(url, { activate: true });
    } else {
      recordEvent("info", "browser", "网页请求打开外部链接", {
        source: "guest",
        tabId: tab.tabId,
        url,
      });
      void openExternalUrl(url);
    }
    return { action: "deny" };
  });

  contents.on("page-title-updated", (_event, title) => {
    tab.title = title?.trim() || getBrowserUrlLabel(tab.url);
    updateStoredEntryTitle(tab.url, tab.title);
    emitState();
  });

  contents.on("page-favicon-updated", (_event, favicons) => {
    tab.favicon = favicons?.[0] ?? null;
    emitState();
  });

  contents.on("did-start-loading", () => {
    tab.loading = true;
    tab.lastError = null;
    recordEvent("info", "browser", "标签页开始加载", {
      source: "guest",
      tabId: tab.tabId,
      url: tab.url,
    });
    emitState();
  });

  contents.on("did-stop-loading", () => {
    syncNavigationState(tab);
    tab.title = contents.getTitle()?.trim() || getBrowserUrlLabel(tab.url);
    recordHistoryVisit(tab);
    emitState();
  });

  contents.on("did-navigate", (_event, url) => {
    tab.url = url;
    tab.selectedText = "";
    syncNavigationState(tab);
    emitState();
  });

  contents.on("did-navigate-in-page", (_event, url) => {
    tab.url = url;
    syncNavigationState(tab);
    recordHistoryVisit(tab);
    emitState();
  });

  contents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      if (errorCode === -3) {
        return;
      }

      tab.lastError = errorDescription;
      tab.url = validatedURL || tab.url;
      tab.loading = false;
      syncNavigationState(tab);
      recordEvent("error", "browser", "标签页加载失败", {
        source: "guest",
        tabId: tab.tabId,
        url: tab.url,
        kind: "page-load-failure",
        details: { errorCode, errorDescription, validatedURL },
      });
      emitState();
    },
  );

  contents.on("render-process-gone", (_event, details) => {
    tab.lastError = `页面渲染进程异常退出：${details.reason}`;
    tab.loading = false;
    recordEvent("error", "browser", "网页渲染进程异常退出", {
      source: "guest",
      tabId: tab.tabId,
      url: tab.url,
      kind: "guest-crash",
      details,
    });
    emitState();
  });

  contents.on("destroyed", () => {
    unmapWebContentsId(contents.id);
  });
}
