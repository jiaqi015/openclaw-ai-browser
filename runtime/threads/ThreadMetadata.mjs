export function normalizePageKey(url) {
  const raw = `${url ?? ""}`.trim();
  if (!raw || raw === "about:blank" || raw.startsWith("internal://")) {
    return null;
  }

  try {
    const parsed = new URL(raw);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return raw;
  }
}

export function getUrlHostLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

export function getThreadSiteLabel(url) {
  const host = getUrlHostLabel(url);
  return host || "当前页面";
}

export function shouldReuseThreadOnNavigation(previousUrl, nextUrl) {
  try {
    const previous = new URL(previousUrl);
    const next = new URL(nextUrl);
    return previous.origin === next.origin;
  } catch {
    return previousUrl === nextUrl;
  }
}

export function formatThreadTimestampLabel(input) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }

  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
