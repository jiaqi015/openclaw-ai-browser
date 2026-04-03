export type UiLocale = "zh-CN" | "en-US";
export type AssistantLocaleMode = "follow-ui" | UiLocale;

export const SUPPORTED_UI_LOCALES: readonly UiLocale[];
export const DEFAULT_UI_LOCALE: UiLocale;
export const DEFAULT_ASSISTANT_LOCALE_MODE: AssistantLocaleMode;

export function normalizeUiLocale(value: unknown): UiLocale;
export function setCurrentUiLocale(value: unknown): UiLocale;
export function getCurrentUiLocale(): UiLocale;
export function resolveAssistantLocale(
  uiLocale: UiLocale,
  assistantLocaleMode?: AssistantLocaleMode,
): UiLocale;
export function translate(
  locale: UiLocale,
  key: string,
  params?: Record<string, unknown>,
): string;
export function getSurfaceTitle(surface: string, locale: UiLocale): string;
export function getSearchEngineLabel(engine: string, locale: UiLocale): string;
export function getGlassModeLabel(mode: string, locale: UiLocale): string;
export function getAssistantLanguageInstruction(locale: UiLocale): string;
export function getPromptMarkdownInstruction(locale: UiLocale): string;
export function getGenTabLanguageInstruction(locale: UiLocale): string;
export function formatThreadTimestampLabel(input: unknown, locale?: UiLocale): string;
export function formatRelativeTimeAgo(input: unknown, locale?: UiLocale): string;
