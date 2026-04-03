import { Activity, Check } from "lucide-react";
import {
  type GlassMode,
  type SearchEngine,
  useUiPreferences,
} from "../application/use-ui-preferences";
import { cn } from "../lib/utils";
import { useEffect, useState } from "react";
import {
  getGlassModeLabel,
  getSearchEngineLabel,
  translate,
  type UiLocale,
} from "../../shared/localization.mjs";

export function GeneralSettingsSurface(props: {
  onOpenDiagnostics: () => void;
}) {
  const { onOpenDiagnostics } = props;
  const { preferences, setDefaultSearchEngine, setGlassMode, setUiLocale } = useUiPreferences();
  const uiLocale = preferences.uiLocale;
  const [glassPreviewMode, setGlassPreviewMode] = useState<GlassMode>(preferences.glassMode);
  const [settingsTab, setSettingsTab] = useState<
    "appearance" | "language" | "search-engine" | "diagnostics"
  >("appearance");

  useEffect(() => {
    setGlassPreviewMode(preferences.glassMode);
  }, [preferences.glassMode]);

  const glassOptions: Array<{
    mode: GlassMode;
    title: string;
    description: string;
  }> = [
    {
      mode: "frosted",
      title: translate(uiLocale, "glass.frosted.title"),
      description: translate(uiLocale, "glass.frosted.description"),
    },
    {
      mode: "liquid",
      title: translate(uiLocale, "glass.liquid.title"),
      description: translate(uiLocale, "glass.liquid.description"),
    },
  ];
  const searchEngineOptions: Array<{
    id: SearchEngine;
    title: string;
    description: string;
  }> = [
    {
      id: "bing",
      title: translate(uiLocale, "searchEngine.bing.title"),
      description: translate(uiLocale, "searchEngine.bing.description"),
    },
    {
      id: "google",
      title: translate(uiLocale, "searchEngine.google.title"),
      description: translate(uiLocale, "searchEngine.google.description"),
    },
    {
      id: "duckduckgo",
      title: translate(uiLocale, "searchEngine.duckduckgo.title"),
      description: translate(uiLocale, "searchEngine.duckduckgo.description"),
    },
    {
      id: "baidu",
      title: translate(uiLocale, "searchEngine.baidu.title"),
      description: translate(uiLocale, "searchEngine.baidu.description"),
    },
  ];
  const localeOptions: Array<{
    id: UiLocale;
    title: string;
    description: string;
  }> = [
    {
      id: "zh-CN",
      title: translate(uiLocale, "language.option.zh-CN"),
      description: translate(uiLocale, "language.option.zh-CN.description"),
    },
    {
      id: "en-US",
      title: translate(uiLocale, "language.option.en-US"),
      description: translate(uiLocale, "language.option.en-US.description"),
    },
  ];
  const hasPendingGlassChange = glassPreviewMode !== preferences.glassMode;
  const previewSurfaceClass =
    glassPreviewMode === "liquid" ? "glass-liquid border-white/10" : "glass-frosted border-white/5";

  return (
    <div className="surface-screen absolute inset-0 overflow-y-auto p-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-8 text-3xl font-semibold text-white">
          {translate(uiLocale, "settings.title")}
        </h1>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="w-full lg:w-56 lg:shrink-0">
            <div className="lg:sticky lg:top-0">
              <div className="px-1 pb-3 text-[10px] font-bold uppercase tracking-widest text-white/35">
                {translate(uiLocale, "settings.nav")}
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => setSettingsTab("appearance")}
                  className={cn(
                    "surface-card-selectable w-full rounded-[18px] border px-4 py-3 text-left transition-colors",
                    settingsTab === "appearance" && "surface-card-selectable-active",
                  )}
                >
                  <div className="text-sm font-medium text-white">
                    {translate(uiLocale, "settings.appearance")}
                  </div>
                  <div className="mt-1 text-[12px] leading-5 text-white/40">
                    {translate(uiLocale, "settings.appearanceDescription")}
                  </div>
                </button>
                <button
                  onClick={() => setSettingsTab("language")}
                  className={cn(
                    "surface-card-selectable w-full rounded-[18px] border px-4 py-3 text-left transition-colors",
                    settingsTab === "language" && "surface-card-selectable-active",
                  )}
                >
                  <div className="text-sm font-medium text-white">
                    {translate(uiLocale, "settings.language")}
                  </div>
                  <div className="mt-1 text-[12px] leading-5 text-white/40">
                    {translate(uiLocale, "settings.languageDescription")}
                  </div>
                </button>
                <button
                  onClick={() => setSettingsTab("search-engine")}
                  className={cn(
                    "surface-card-selectable w-full rounded-[18px] border px-4 py-3 text-left transition-colors",
                    settingsTab === "search-engine" && "surface-card-selectable-active",
                  )}
                >
                  <div className="text-sm font-medium text-white">
                    {translate(uiLocale, "settings.searchEngine")}
                  </div>
                  <div className="mt-1 text-[12px] leading-5 text-white/40">
                    {translate(uiLocale, "settings.searchEngineCurrent", {
                      value: getSearchEngineLabel(preferences.defaultSearchEngine, uiLocale),
                    })}
                  </div>
                </button>
                <button
                  onClick={() => setSettingsTab("diagnostics")}
                  className={cn(
                    "surface-card-selectable w-full rounded-[18px] border px-4 py-3 text-left transition-colors",
                    settingsTab === "diagnostics" && "surface-card-selectable-active",
                  )}
                >
                  <div className="text-sm font-medium text-white">
                    {translate(uiLocale, "settings.diagnostics")}
                  </div>
                  <div className="mt-1 text-[12px] leading-5 text-white/40">
                    {translate(uiLocale, "settings.diagnosticsDescription")}
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            {settingsTab === "appearance" && (
              <div className="surface-panel rounded-2xl border p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-white">
                      {translate(uiLocale, "settings.appearance")}
                    </h2>
                    <p className="mt-2 text-sm text-white/50">
                      {translate(uiLocale, "settings.previewThenApply")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="surface-badge rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
                      {translate(uiLocale, "settings.applied", {
                        value: getGlassModeLabel(preferences.glassMode, uiLocale),
                      })}
                    </span>
                    <button
                      onClick={() => setGlassMode(glassPreviewMode)}
                      disabled={!hasPendingGlassChange}
                      className={cn(
                        "surface-button-system rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
                        !hasPendingGlassChange &&
                          "cursor-default border-white/10 bg-white/[0.04] text-white/35",
                      )}
                    >
                      {translate(uiLocale, "settings.applyToInterface")}
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {glassOptions.map((option) => {
                    const isSelected = option.mode === glassPreviewMode;
                    return (
                      <button
                        key={option.mode}
                        onClick={() => setGlassPreviewMode(option.mode)}
                        className={cn(
                          "surface-card-selectable group relative flex flex-col gap-3 rounded-[20px] border p-5 text-left transition-all",
                          isSelected && "surface-card-selectable-active",
                          option.mode === "frosted" ? "bg-black/40 backdrop-blur-2xl" : "glass-liquid",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-1">
                            <h3 className="text-base font-medium text-white/88">{option.title}</h3>
                            <p className="text-[12px] text-white/46">
                              {translate(
                                uiLocale,
                                option.mode === "liquid"
                                  ? "glass.liquid.mood"
                                  : "glass.frosted.mood",
                              )}
                            </p>
                          </div>
                          <div
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                              isSelected
                                ? "border-white/20 bg-white/12 text-white"
                                : "border-white/10 text-transparent",
                            )}
                          >
                            <Check className="h-3 w-3" />
                          </div>
                        </div>

                        <div
                          className={cn(
                            "flex h-24 items-center justify-center rounded-xl border p-3",
                            option.mode === "liquid" ? "glass-liquid" : "glass-frosted",
                          )}
                        >
                          <div className="h-full w-full rounded-[8px] border border-white/10 opacity-60" />
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="surface-panel mt-5 rounded-[24px] border p-5">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-sm font-medium text-white">
                      {translate(uiLocale, "settings.preview")}
                    </h3>
                    <span className="surface-badge rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
                      {translate(uiLocale, "settings.previewing", {
                        value: getGlassModeLabel(glassPreviewMode, uiLocale),
                      })}
                    </span>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-[#050505]/50">
                    <div className={cn("flex h-11 items-center gap-2 border-b border-white/8 px-4", previewSurfaceClass)}>
                      <div className="h-3 w-3 rounded-full bg-white/18" />
                      <div className="h-3 w-3 rounded-full bg-white/14" />
                      <div className="h-3 w-3 rounded-full bg-white/10" />
                      <div className="ml-3 h-7 flex-1 rounded-full border border-white/10 bg-white/[0.04]" />
                    </div>

                    <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-4 p-4">
                      <div className={cn("rounded-[20px] border p-3", previewSurfaceClass)}>
                        <div className="space-y-2">
                          <div className="h-9 rounded-2xl bg-white/[0.08]" />
                          <div className="h-9 rounded-2xl bg-white/[0.06]" />
                          <div className="h-9 rounded-2xl bg-white/[0.06]" />
                          <div className="h-20 rounded-[18px] bg-white/[0.04]" />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className={cn("rounded-[20px] border p-4", previewSurfaceClass)}>
                          <div className="h-3 w-28 rounded-full bg-white/18" />
                          <div className="mt-3 h-10 rounded-[18px] bg-white/[0.07]" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className={cn("rounded-[20px] border p-4", previewSurfaceClass)}>
                            <div className="h-3 w-16 rounded-full bg-white/18" />
                            <div className="mt-3 space-y-2">
                              <div className="h-3 rounded-full bg-white/[0.12]" />
                              <div className="h-3 w-5/6 rounded-full bg-white/[0.1]" />
                              <div className="h-12 rounded-[16px] bg-white/[0.06]" />
                            </div>
                          </div>

                          <div className={cn("rounded-[20px] border p-4", previewSurfaceClass)}>
                            <div className="h-3 w-16 rounded-full bg-white/18" />
                            <div className="mt-3 space-y-2">
                              <div className="h-3 rounded-full bg-white/[0.12]" />
                              <div className="h-3 w-4/6 rounded-full bg-white/[0.1]" />
                              <div className="h-12 rounded-[16px] bg-white/[0.06]" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="px-4 pb-4">
                      <div className={cn("mx-auto h-14 max-w-[360px] rounded-[22px] border", previewSurfaceClass)} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {settingsTab === "language" && (
              <div className="surface-panel rounded-2xl border p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-white">
                      {translate(uiLocale, "language.title")}
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-white/50">
                      {translate(uiLocale, "language.description")}
                    </p>
                  </div>
                  <span className="surface-badge rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
                    {translate(uiLocale, "language.option." + preferences.uiLocale)}
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/34">
                    {translate(uiLocale, "language.interface")}
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {localeOptions.map((option) => {
                      const isSelected = option.id === preferences.uiLocale;
                      return (
                        <button
                          key={option.id}
                          onClick={() => setUiLocale(option.id)}
                          className={cn(
                            "surface-card-selectable w-full rounded-[20px] border p-5 text-left transition-colors",
                            isSelected && "surface-card-selectable-active",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-base font-medium text-white">{option.title}</div>
                              <p className="mt-3 text-sm leading-6 text-white/50">
                                {option.description}
                              </p>
                            </div>
                            <div
                              className={cn(
                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                                isSelected
                                  ? "border-white/20 bg-white/12 text-white"
                                  : "border-white/10 text-transparent",
                              )}
                            >
                              <Check className="h-3 w-3" />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-sm leading-7 text-white/50">
                    {translate(uiLocale, "language.aiFollowsUi")}
                  </p>
                </div>
              </div>
            )}

            {settingsTab === "search-engine" && (
              <div className="surface-panel rounded-2xl border p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-white">
                      {translate(uiLocale, "settings.searchEngine")}
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-white/50">
                      {translate(uiLocale, "settings.searchEngineIntro")}
                    </p>
                  </div>
                  <span className="surface-badge rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
                    {translate(uiLocale, "settings.searchEngineCurrent", {
                      value: getSearchEngineLabel(preferences.defaultSearchEngine, uiLocale),
                    })}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {searchEngineOptions.map((option) => {
                    const isSelected = option.id === preferences.defaultSearchEngine;
                    return (
                      <button
                        key={option.id}
                        onClick={() => setDefaultSearchEngine(option.id)}
                        className={cn(
                          "surface-card-selectable w-full rounded-[20px] border p-5 text-left transition-colors",
                          isSelected && "surface-card-selectable-active",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-base font-medium text-white">{option.title}</div>
                          <div
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                              isSelected
                                ? "border-white/20 bg-white/12 text-white"
                                : "border-white/10 text-transparent",
                            )}
                          >
                            <Check className="h-3 w-3" />
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-white/50">{option.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {settingsTab === "diagnostics" && (
              <div className="surface-panel rounded-2xl border p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-medium text-white">
                      {translate(uiLocale, "settings.localDiagnostics")}
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-white/50">
                      {translate(uiLocale, "settings.diagnosticsIntro")}
                    </p>
                  </div>
                  <button
                    onClick={onOpenDiagnostics}
                    className="surface-button-system flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                  >
                    <Activity className="h-4 w-4" />
                    {translate(uiLocale, "settings.openDiagnostics")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
