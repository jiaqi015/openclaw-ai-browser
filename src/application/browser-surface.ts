import type { SearchEngine } from "./use-ui-preferences";

export type PendingNavigation = {
  title: string;
  url: string;
};

export type SurfaceMode =
  | "browser"
  | "newtab"
  | "history"
  | "bookmarks"
  | "downloads"
  | "diagnostics"
  | "general-settings"
  | "settings"
  | "skills";

export type TabSurface = Exclude<SurfaceMode, "browser">;
export type InternalSurface = Exclude<TabSurface, "newtab">;
export type MainSurfaceMode = Exclude<SurfaceMode, "newtab" | "skills">;
export type SystemEntryIconName = TabSurface | "clear-history" | "download-latest";

export type BrowserMenuCommand =
  | "history"
  | "bookmarks"
  | "downloads"
  | "diagnostics"
  | "clear-history"
  | "general-settings"
  | "settings"
  | "download-latest";

export const tabSurfaceMeta: Record<TabSurface, { title: string; url: string; icon: SystemEntryIconName }> = {
  newtab: { title: "新标签页", url: "internal://newtab", icon: "newtab" },
  history: { title: "历史浏览", url: "internal://history", icon: "history" },
  bookmarks: { title: "书签", url: "internal://bookmarks", icon: "bookmarks" },
  downloads: { title: "下载内容", url: "internal://downloads", icon: "downloads" },
  diagnostics: { title: "诊断中心", url: "internal://diagnostics", icon: "diagnostics" },
  "general-settings": { title: "设置", url: "internal://general-settings", icon: "general-settings" },
  settings: { title: "龙虾连接", url: "internal://settings", icon: "settings" },
  skills: { title: "技能馆", url: "internal://skills", icon: "skills" },
};

const strongChatPrefixes = [
  /^@?(龙虾|sabrina)(?:[\s,:，：-]|$)/iu,
  /^(帮我|请帮我|请你|麻烦你|帮忙|总结|概括|提取|解释|分析|翻译|改写|润色|扩写|生成|对比|整理|归纳|计算|写(?:个|一|篇|封|段)?|列出|告诉我|教我|问你|请问)(?:[\s,:，：-]|$)/u,
  /^(help me|please|explain|summarize|translate|rewrite|polish|analyze|compare|write|list|tell me|show me)(?:[\s,:,-]|$)/iu,
] as const;

const conversationalSentencePattern =
  /(帮我|请帮我|请你|麻烦你|帮忙|龙虾|sabrina|总结|概括|提取|解释|分析|翻译|改写|润色|扩写|生成|对比|整理|归纳|计算|写个|写一|写篇|写封|列出|告诉我|教我|问你|请问|help me|please|explain|summarize|translate|rewrite|polish|analyze|compare|write|list|tell me|show me)/iu;

function buildSearchUrl(query: string, searchEngine: SearchEngine) {
  const encodedQuery = encodeURIComponent(query);

  if (searchEngine === "google") {
    return `https://www.google.com/search?q=${encodedQuery}`;
  }

  if (searchEngine === "duckduckgo") {
    return `https://duckduckgo.com/?q=${encodedQuery}`;
  }

  if (searchEngine === "baidu") {
    return `https://www.baidu.com/s?wd=${encodedQuery}`;
  }

  return `https://www.bing.com/search?q=${encodedQuery}`;
}

export function normalizeBrowserInput(input: string, searchEngine: SearchEngine = "bing") {
  const raw = input.trim();
  if (!raw) {
    return "about:blank";
  }

  if (/^https?:\/\//i.test(raw) || /^about:/i.test(raw)) {
    return raw;
  }

  if (/^(localhost|\d{1,3}(?:\.\d{1,3}){3})(:\d+)?(\/.*)?$/i.test(raw)) {
    return `https://${raw}`;
  }

  if (raw.includes(".") && !/\s/.test(raw)) {
    return `https://${raw}`;
  }

  return buildSearchUrl(raw, searchEngine);
}

export function shouldRouteNewTabInputToChat(input: string) {
  const raw = input.trim();
  if (!raw) {
    return false;
  }

  if (/^https?:\/\//i.test(raw) || /^about:/i.test(raw)) {
    return false;
  }

  if (/^(localhost|\d{1,3}(?:\.\d{1,3}){3})(:\d+)?(\/.*)?$/i.test(raw)) {
    return false;
  }

  if (raw.includes(".") && !/\s/.test(raw)) {
    return false;
  }

  if (strongChatPrefixes.some((pattern) => pattern.test(raw))) {
    return true;
  }

  return /[。！!？?]$/.test(raw) && conversationalSentencePattern.test(raw);
}

export function normalizeNewTabChatPrompt(input: string) {
  const raw = input.trim();
  const normalized = raw
    .replace(/^@\s*/u, "")
    .replace(/^(?:@?(?:龙虾|sabrina))[\s,:，：-]*/iu, "")
    .trim();

  return normalized || raw;
}

export function resolveInternalSurfaceFromMenuCommand(
  command: BrowserMenuCommand,
): InternalSurface | null {
  if (
    command === "history" ||
    command === "bookmarks" ||
    command === "downloads" ||
    command === "diagnostics" ||
    command === "general-settings" ||
    command === "settings"
  ) {
    return command;
  }

  return null;
}
