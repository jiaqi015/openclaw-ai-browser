import type { InternalSurface } from "../application/browser-surface";
import {
  DEFAULT_UI_LOCALE,
  normalizeUiLocale,
  type UiLocale,
} from "../../shared/localization.mjs";

function getQaSearchParams() {
  if (typeof window === "undefined" || !import.meta.env.DEV) {
    return null;
  }

  return new URLSearchParams(window.location.search);
}

export function getQaUiLocaleOverride(): UiLocale | null {
  const params = getQaSearchParams();
  const candidate = params?.get("qa-locale")?.trim();
  if (!candidate) {
    return null;
  }

  const normalized = normalizeUiLocale(candidate);
  return normalized === DEFAULT_UI_LOCALE && candidate !== DEFAULT_UI_LOCALE
    ? null
    : normalized;
}

export function getQaInitialSurface(): InternalSurface | null {
  const params = getQaSearchParams();
  const candidate = `${params?.get("qa-surface") ?? ""}`.trim();
  if (
    candidate === "history" ||
    candidate === "bookmarks" ||
    candidate === "downloads" ||
    candidate === "diagnostics" ||
    candidate === "general-settings" ||
    candidate === "settings" ||
    candidate === "skills"
  ) {
    return candidate;
  }

  return null;
}
