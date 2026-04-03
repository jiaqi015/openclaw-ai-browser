import { Activity, Check } from "lucide-react";
import {
  type GlassMode,
  type SearchEngine,
  useUiPreferences,
} from "../application/use-ui-preferences";
import { cn } from "../lib/utils";
import { useEffect, useState } from "react";

function getGlassModeLabel(mode: GlassMode) {
  return mode === "liquid" ? "液态玻璃" : "毛玻璃";
}

function getSearchEngineLabel(searchEngine: SearchEngine) {
  if (searchEngine === "google") {
    return "谷歌";
  }

  if (searchEngine === "duckduckgo") {
    return "隐私搜索";
  }

  if (searchEngine === "baidu") {
    return "百度";
  }

  return "必应";
}

export function GeneralSettingsSurface(props: {
  onOpenDiagnostics: () => void;
}) {
  const { onOpenDiagnostics } = props;
  const { preferences, setDefaultSearchEngine, setGlassMode } = useUiPreferences();
  const [glassPreviewMode, setGlassPreviewMode] = useState<GlassMode>(preferences.glassMode);
  const [settingsTab, setSettingsTab] = useState<"appearance" | "search-engine" | "diagnostics">(
    "appearance",
  );

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
      title: "毛玻璃",
      description: "经典深色毛玻璃，对比度更高，阅读更稳。",
    },
    {
      mode: "liquid",
      title: "液态玻璃",
      description: "更通透轻盈，层次感更明显。",
    },
  ];
  const searchEngineOptions: Array<{
    id: SearchEngine;
    title: string;
    description: string;
  }> = [
    {
      id: "bing",
      title: "必应",
      description: "当前默认方案，综合网页结果覆盖比较均衡。",
    },
    {
      id: "google",
      title: "谷歌",
      description: "更适合开发、文档和国际化搜索场景。",
    },
    {
      id: "duckduckgo",
      title: "隐私搜索",
      description: "更轻量，也更强调隐私。",
    },
    {
      id: "baidu",
      title: "百度",
      description: "更适合中文内容和本地化信息检索。",
    },
  ];
  const hasPendingGlassChange = glassPreviewMode !== preferences.glassMode;
  const previewSurfaceClass =
    glassPreviewMode === "liquid" ? "glass-liquid border-white/10" : "glass-frosted border-white/5";

  return (
    <div className="surface-screen absolute inset-0 overflow-y-auto p-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-8 text-3xl font-semibold text-white">设置</h1>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="w-full lg:w-56 lg:shrink-0">
            <div className="lg:sticky lg:top-0">
              <div className="px-1 pb-3 text-[10px] font-bold uppercase tracking-widest text-white/35">
                设置导航
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => setSettingsTab("appearance")}
                  className={cn(
                    "surface-card-selectable w-full rounded-[18px] border px-4 py-3 text-left transition-colors",
                    settingsTab === "appearance" && "surface-card-selectable-active",
                  )}
                >
                  <div className="text-sm font-medium text-white">外观设置</div>
                  <div className="mt-1 text-[12px] leading-5 text-white/40">玻璃材质预览与应用</div>
                </button>
                <button
                  onClick={() => setSettingsTab("search-engine")}
                  className={cn(
                    "surface-card-selectable w-full rounded-[18px] border px-4 py-3 text-left transition-colors",
                    settingsTab === "search-engine" && "surface-card-selectable-active",
                  )}
                >
                  <div className="text-sm font-medium text-white">默认搜索引擎</div>
                  <div className="mt-1 text-[12px] leading-5 text-white/40">
                    当前是 {getSearchEngineLabel(preferences.defaultSearchEngine)}
                  </div>
                </button>
                <button
                  onClick={() => setSettingsTab("diagnostics")}
                  className={cn(
                    "surface-card-selectable w-full rounded-[18px] border px-4 py-3 text-left transition-colors",
                    settingsTab === "diagnostics" && "surface-card-selectable-active",
                  )}
                >
                  <div className="text-sm font-medium text-white">诊断与日志</div>
                  <div className="mt-1 text-[12px] leading-5 text-white/40">本地错误、网络与日志</div>
                </button>
              </div>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            {settingsTab === "appearance" && (
              <div className="surface-panel rounded-2xl border p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-white">外观设置</h2>
                    <p className="mt-2 text-sm text-white/50">先预览，再应用。</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="surface-badge rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
                      已应用 {getGlassModeLabel(preferences.glassMode)}
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
                      应用到界面
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
                              {option.mode === "liquid" ? "更亮，更悬浮。" : "更稳，更克制。"}
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
                    <h3 className="text-sm font-medium text-white">预览</h3>
                    <span className="surface-badge rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
                      预览中 {getGlassModeLabel(glassPreviewMode)}
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

            {settingsTab === "search-engine" && (
              <div className="surface-panel rounded-2xl border p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-white">默认搜索引擎</h2>
                    <p className="mt-2 text-sm leading-7 text-white/50">
                      地址栏输入普通关键词时，会自动使用这里选中的搜索引擎发起搜索。
                    </p>
                  </div>
                  <span className="surface-badge rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
                    当前 {getSearchEngineLabel(preferences.defaultSearchEngine)}
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
                    <h2 className="text-lg font-medium text-white">本地诊断与日志</h2>
                    <p className="mt-2 text-sm leading-7 text-white/50">
                      现在可以直接查看最近错误、网络失败、AI 调用耗时，并一键打开日志目录。
                    </p>
                  </div>
                  <button
                    onClick={onOpenDiagnostics}
                    className="surface-button-system flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
                  >
                    <Activity className="h-4 w-4" />
                    打开诊断中心
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
