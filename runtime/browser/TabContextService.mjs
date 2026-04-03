import {
  getTabContextSource,
  maxSelectionChars,
} from "./TabManager.mjs";
import { extractPageContextSnapshot } from "./PageContextService.mjs";

export async function getContextSnapshotForTab(tabId) {
  const normalizedTabId = `${tabId ?? ""}`.trim();
  const contextSource = getTabContextSource(normalizedTabId || null);
  if (!contextSource) {
    throw new Error("未找到可提取上下文的标签页。");
  }

  return extractPageContextSnapshot({
    webContents: contextSource.webContents,
    fallbackTitle: contextSource.title,
    fallbackUrl: contextSource.url,
    selectedText: contextSource.selectedText,
    maxSelectionChars,
  });
}
