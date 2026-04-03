import { createContext, useContext, useState, useEffect } from "react";

export type GlassMode = "frosted" | "liquid";
export type SearchEngine = "bing" | "google" | "duckduckgo" | "baidu";

export interface UiPreferences {
  glassMode: GlassMode;
  defaultSearchEngine: SearchEngine;
}

const storageKey = "sabrina-ui-preferences-v1";

const defaultPreferences: UiPreferences = {
  glassMode: "frosted",
  defaultSearchEngine: "bing",
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
    return { ...defaultPreferences, ...parsed };
  } catch {
    return defaultPreferences;
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
};

const UiPreferencesContext = createContext<UiPreferencesContextValue | null>(null);

export function UiPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<UiPreferences>(readSavedPreferences);

  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.body.dataset.glassMode = preferences.glassMode;
  }, [preferences.glassMode]);

  const setGlassMode = (mode: GlassMode) => {
    setPreferences((prev) => ({ ...prev, glassMode: mode }));
  };

  const setDefaultSearchEngine = (engine: SearchEngine) => {
    setPreferences((prev) => ({ ...prev, defaultSearchEngine: engine }));
  };

  return (
    <UiPreferencesContext.Provider value={{ preferences, setGlassMode, setDefaultSearchEngine }}>
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
