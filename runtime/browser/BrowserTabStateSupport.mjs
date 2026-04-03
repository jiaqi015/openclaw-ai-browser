import { getBrowserUrlLabel } from "./BrowserUrlService.mjs";

export const defaultTabUrl = "about:blank";
export const maxSelectionChars = 4000;

export function getBrowserTabContextSource(tab) {
  if (!tab) {
    return null;
  }

  return {
    webContents: tab.view.webContents,
    title: tab.title || getBrowserUrlLabel(tab.url),
    url: tab.url,
    selectedText: tab.selectedText,
  };
}

export function serializeBrowserTab(tab) {
  return {
    tabId: tab.tabId,
    title: tab.title || getBrowserUrlLabel(tab.url),
    url: tab.url,
    loading: tab.loading,
    canGoBack: tab.canGoBack,
    canGoForward: tab.canGoForward,
    selectedText: tab.selectedText,
    favicon: tab.favicon,
    lastError: tab.lastError,
  };
}

export function normalizeBrowserAddressInput(input) {
  const raw = `${input ?? ""}`.trim();
  if (!raw) {
    return { url: defaultTabUrl };
  }
  if (/^https?:\/\//i.test(raw) || /^about:/i.test(raw)) {
    return { url: raw };
  }
  if (/^(localhost|\d{1,3}(?:\.\d{1,3}){3})(:\d+)?(\/.*)?$/i.test(raw)) {
    return { url: `https://${raw}` };
  }
  if (raw.includes(".") && !/\s/.test(raw)) {
    return { url: `https://${raw}` };
  }
  return { url: `https://www.bing.com/search?q=${encodeURIComponent(raw)}` };
}
