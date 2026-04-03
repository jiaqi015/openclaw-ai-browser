export const SUPPORTED_UI_LOCALES: readonly ["zh-CN", "en-US"];
export const DEFAULT_UI_LOCALE: "zh-CN";
export const DEFAULT_ASSISTANT_LOCALE_MODE: "follow-ui";

export type UiLocale = "zh-CN" | "en-US";
export type AssistantLocaleMode = "follow-ui" | UiLocale;

export function normalizeUiLocale(value: unknown): UiLocale;
export function setCurrentUiLocale(value: unknown): UiLocale;
export function getCurrentUiLocale(): UiLocale;
export function resolveAssistantLocale(
  uiLocale: unknown,
  assistantLocaleMode?: unknown,
): UiLocale;
export function translate(
  locale: unknown,
  key: string,
  params?: Record<string, unknown>,
): string;
export function getSurfaceTitle(surface: string, locale: unknown): string;
export function getSearchEngineLabel(engine: string, locale: unknown): string;
export function getGlassModeLabel(mode: string, locale: unknown): string;
export function getAssistantLanguageInstruction(locale: unknown): string;
export function getPromptMarkdownInstruction(locale: unknown): string;
export function getGenTabLanguageInstruction(locale: unknown): string;
export function formatThreadTimestampLabel(input: unknown, locale?: unknown): string;
export function formatRelativeTimeAgo(input: unknown, locale?: unknown): string;
