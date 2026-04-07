import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getSabrinaDesktop } from "../lib/sabrina-desktop";
import { getQaUiLocaleOverride } from "../lib/qa-boot";
import {
  DEFAULT_ASSISTANT_LOCALE_MODE,
  DEFAULT_UI_LOCALE,
  resolveAssistantLocale,
  setCurrentUiLocale,
  translate,
  type AssistantLocaleMode,
  type UiLocale,
} from "../../shared/localization.mjs";

export type GlassMode = "frosted" | "liquid";
export type SearchEngine = "bing" | "google" | "duckduckgo" | "baidu";

export interface UiPreferences {
  glassMode: GlassMode;
  defaultSearchEngine: SearchEngine;
  uiLocale: UiLocale;
  assistantLocaleMode: AssistantLocaleMode;
}

const storageKey = "sabrina-ui-preferences-v1";

const defaultPreferences: UiPreferences = {
  glassMode: "frosted",
  defaultSearchEngine: "bing",
  uiLocale: DEFAULT_UI_LOCALE,
  assistantLocaleMode: DEFAULT_ASSISTANT_LOCALE_MODE,
};

function readSavedPreferences(): UiPreferences {
  if (typeof window === "undefined") {
    return defaultPreferences;
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return defaultPreferences;
    }
    const parsed = JSON.parse(raw);
    const merged = { ...defaultPreferences, ...parsed };
    const qaLocale = getQaUiLocaleOverride();
    if (!qaLocale) {
      return merged;
    }

    return {
      ...merged,
      uiLocale: qaLocale,
      assistantLocaleMode:
        merged.assistantLocaleMode === "follow-ui" ? "follow-ui" : qaLocale,
    };
  } catch {
    const qaLocale = getQaUiLocaleOverride();
    if (!qaLocale) {
      return defaultPreferences;
    }

    return {
      ...defaultPreferences,
      uiLocale: qaLocale,
    };
  }
}

function savePreferences(prefs: UiPreferences) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(storageKey, JSON.stringify(prefs));
}

type UiPreferencesContextValue = {
  preferences: UiPreferences;
  setGlassMode: (mode: GlassMode) => void;
  setDefaultSearchEngine: (engine: SearchEngine) => void;
  setUiLocale: (locale: UiLocale) => void;
  assistantLocale: UiLocale;
  t: (key: string, params?: Record<string, unknown>) => string;
};

const UiPreferencesContext = createContext<UiPreferencesContextValue | null>(null);

export function UiPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<UiPreferences>(readSavedPreferences);
  const assistantLocale = resolveAssistantLocale(
    preferences.uiLocale,
    preferences.assistantLocaleMode,
  );
  const t = useMemo(
    () => (key: string, params?: Record<string, unknown>) =>
      translate(preferences.uiLocale, key, params),
    [preferences.uiLocale],
  );

  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.body.dataset.glassMode = preferences.glassMode;
    document.documentElement.lang = preferences.uiLocale;
    setCurrentUiLocale(preferences.uiLocale);
  }, [preferences.glassMode, preferences.uiLocale]);

  useEffect(() => {
    void getSabrinaDesktop()?.setUiLocale?.(preferences.uiLocale);
  }, [preferences.uiLocale]);

  const setGlassMode = (mode: GlassMode) => {
    setPreferences((prev) => ({ ...prev, glassMode: mode }));
  };

  const setDefaultSearchEngine = (engine: SearchEngine) => {
    setPreferences((prev) => ({ ...prev, defaultSearchEngine: engine }));
  };

  const setUiLocale = (locale: UiLocale) => {
    setPreferences((prev) => ({
      ...prev,
      uiLocale: locale,
      assistantLocaleMode:
        prev.assistantLocaleMode === "follow-ui" ? "follow-ui" : locale,
    }));
  };

  return (
    <UiPreferencesContext.Provider
      value={{
        preferences,
        setGlassMode,
        setDefaultSearchEngine,
        setUiLocale,
        assistantLocale,
        t,
      }}
    >
      {children}
    </UiPreferencesContext.Provider>
  );
}

export function useUiPreferences(): UiPreferencesContextValue {
  const context = useContext(UiPreferencesContext);
  if (!context) {
    throw new Error("useUiPreferences must be used within UiPreferencesProvider");
  }
  return context;
}

export function getGlassClassName(
  glassMode: GlassMode,
  variant: "dark" | "normal" = "dark"
): string {
  if (glassMode === "liquid" && variant === "normal") {
    return "glass-liquid-normal";
  }

  if (glassMode === "liquid") {
    return "glass-liquid-dark";
  }

  if (variant === "normal") {
    return "glass";
  }
  return "glass-frosted";
}
