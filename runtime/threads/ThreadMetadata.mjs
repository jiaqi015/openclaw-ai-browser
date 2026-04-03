import {
  formatThreadTimestampLabel as formatLocalizedThreadTimestampLabel,
  getCurrentUiLocale,
  translate,
} from "../../shared/localization.mjs";

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
  return host || translate(getCurrentUiLocale(), "common.currentPage");
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

export function formatThreadTimestampLabel(input, locale = getCurrentUiLocale()) {
  return formatLocalizedThreadTimestampLabel(input, locale);
}
