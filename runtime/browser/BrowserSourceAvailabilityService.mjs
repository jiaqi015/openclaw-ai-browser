import { normalizeBrowserSourceRoute } from "./BrowserContextPackageService.mjs";

function buildUnavailableAvailability(reason, label) {
  return {
    state: "unavailable",
    reason,
    label,
    canReference: false,
    canUseAsPrimary: false,
  };
}

export function buildBrowserSourceAvailability(tab) {
  if (!tab) {
    return buildUnavailableAvailability("missing-tab", "页面不存在");
  }

  const normalizedUrl = `${tab.url ?? ""}`.trim();
  if (!normalizedUrl) {
    return buildUnavailableAvailability("missing-url", "缺少可用 URL");
  }

  if (tab.lastError) {
    return {
      state: "error",
      reason: "page-load-failed",
      label: "页面加载失败",
      canReference: false,
      canUseAsPrimary: false,
    };
  }

  if (tab.loading) {
    return {
      state: "loading",
      reason: "page-loading",
      label: "页面仍在加载",
      canReference: false,
      canUseAsPrimary: false,
    };
  }

  const route = normalizeBrowserSourceRoute(normalizedUrl);
  if (!route.canExecute) {
    if (route.kind === "internal-surface") {
      return buildUnavailableAvailability("internal-surface", "浏览器内部页暂不可引用");
    }

    if (route.kind === "local-file") {
      return buildUnavailableAvailability("local-file-unavailable", "本地文件暂不可引用");
    }

    if (route.kind === "missing-url") {
      return buildUnavailableAvailability("missing-url", "缺少可用 URL");
    }

    return buildUnavailableAvailability("unsupported-source", "当前页面暂不支持引用");
  }

  return {
    state: "ready",
    reason: "ready",
    label: route.label,
    canReference: true,
    canUseAsPrimary: true,
  };
}
