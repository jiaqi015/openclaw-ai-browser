import { DEFAULT_UI_LOCALE, normalizeUiLocale, translate } from "../../shared/localization.mjs";

export type SabrinaChatMessage = SabrinaChatMessageRecord;

export function createChatMessageId() {
  return `msg-${Math.random().toString(36).slice(2, 10)}`;
}

function getRendererLocale() {
  if (typeof document === "undefined") {
    return DEFAULT_UI_LOCALE;
  }

  return normalizeUiLocale(document.documentElement.lang || DEFAULT_UI_LOCALE);
}

export function buildWelcomeMessage(tab: SabrinaDesktopTab): SabrinaChatMessage {
  const locale = getRendererLocale();
  return {
    messageId: createChatMessageId(),
    role: "system",
    text: [
      translate(locale, "thread.welcomeTitle"),
      translate(locale, "thread.welcomeCurrentTab", {
        title: tab.title || translate(locale, "common.newTab"),
      }),
      translate(locale, "thread.welcomeSummary"),
      translate(locale, "thread.welcomeSelection"),
    ].join("\n"),
  };
}

export function normalizeChatError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return translate(getRendererLocale(), "error.requestFailed");
}
