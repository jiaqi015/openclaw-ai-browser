import { commonMessages } from "./locales/common.mjs";
import { diagnosticsMessages } from "./locales/diagnostics.mjs";
import { gentabMessages } from "./locales/gentab.mjs";
import { openclawMessages } from "./locales/openclaw.mjs";
import { runtimeMessages } from "./locales/runtime.mjs";
import { skillsMessages } from "./locales/skills.mjs";
import { threadMessages } from "./locales/thread.mjs";
import { agentMessages } from "./locales/agent.mjs";

export const SUPPORTED_UI_LOCALES = Object.freeze(["zh-CN", "en-US"]);
export const DEFAULT_UI_LOCALE = "zh-CN";
export const DEFAULT_ASSISTANT_LOCALE_MODE = "follow-ui";

let currentUiLocale = DEFAULT_UI_LOCALE;

const MESSAGE_GROUPS = Object.freeze([
  commonMessages,
  threadMessages,
  skillsMessages,
  gentabMessages,
  diagnosticsMessages,
  openclawMessages,
  runtimeMessages,
  agentMessages,
]);

const MESSAGES = Object.freeze(
  Object.fromEntries(
    SUPPORTED_UI_LOCALES.map((locale) => [
      locale,
      Object.freeze(
        Object.assign({}, ...MESSAGE_GROUPS.map((group) => group[locale] ?? {})),
      ),
    ]),
  ),
);

function formatTemplate(template, params = {}) {
  return `${template}`.replace(/\{(\w+)\}/g, (_match, key) => {
    const value = params[key];
    return value == null ? "" : String(value);
  });
}

export function normalizeUiLocale(value) {
  return SUPPORTED_UI_LOCALES.includes(value) ? value : DEFAULT_UI_LOCALE;
}

export function setCurrentUiLocale(value) {
  currentUiLocale = normalizeUiLocale(value);
  return currentUiLocale;
}

export function getCurrentUiLocale() {
  return currentUiLocale;
}

export function resolveAssistantLocale(uiLocale, assistantLocaleMode = DEFAULT_ASSISTANT_LOCALE_MODE) {
  const normalizedUiLocale = normalizeUiLocale(uiLocale);
  if (assistantLocaleMode === "zh-CN" || assistantLocaleMode === "en-US") {
    return assistantLocaleMode;
  }

  return normalizedUiLocale;
}

export function translate(locale, key, params = {}) {
  const normalizedLocale = normalizeUiLocale(locale);
  const template =
    MESSAGES[normalizedLocale]?.[key] ??
    MESSAGES[DEFAULT_UI_LOCALE]?.[key] ??
    key;

  return formatTemplate(template, params);
}

export function getSurfaceTitle(surface, locale) {
  return translate(locale, `surface.${surface}`);
}

export function getSearchEngineLabel(engine, locale) {
  return translate(locale, `searchEngine.${engine}.title`);
}

export function getGlassModeLabel(mode, locale) {
  return translate(locale, `glass.${mode}.title`);
}

export function getAssistantLanguageInstruction(locale) {
  const normalizedLocale = normalizeUiLocale(locale);
  return normalizedLocale === "en-US"
    ? translate(normalizedLocale, "prompt.replyInEnglish")
    : translate(normalizedLocale, "prompt.replyInChinese");
}

export function getPromptMarkdownInstruction(locale) {
  const normalizedLocale = normalizeUiLocale(locale);
  return normalizedLocale === "en-US"
    ? translate(normalizedLocale, "prompt.outputMarkdownSafeEn")
    : translate(normalizedLocale, "prompt.outputMarkdownSafeZh");
}

export function getGenTabLanguageInstruction(locale) {
  const normalizedLocale = normalizeUiLocale(locale);
  return normalizedLocale === "en-US"
    ? translate(normalizedLocale, "prompt.genTabLanguageEn")
    : translate(normalizedLocale, "prompt.genTabLanguageZh");
}

export function formatThreadTimestampLabel(input, locale = getCurrentUiLocale()) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return translate(locale, "common.justNow");
  }

  return date.toLocaleString(normalizeUiLocale(locale), {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatRelativeTimeAgo(input, locale = getCurrentUiLocale()) {
  const deltaMs = Date.now() - new Date(input).getTime();
  if (!Number.isFinite(deltaMs)) {
    return translate(locale, "common.justNow");
  }

  const normalizedLocale = normalizeUiLocale(locale);
  const seconds = Math.max(0, Math.round(deltaMs / 1000));
  if (seconds < 60) {
    return normalizedLocale === "en-US" ? `${seconds}s ago` : `${seconds}s 前`;
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return normalizedLocale === "en-US" ? `${minutes}m ago` : `${minutes}m 前`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return normalizedLocale === "en-US" ? `${hours}h ago` : `${hours}h 前`;
  }

  const days = Math.round(hours / 24);
  return normalizedLocale === "en-US" ? `${days}d ago` : `${days}d 前`;
}
