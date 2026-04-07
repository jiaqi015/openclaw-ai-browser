import { useMemo } from "react";
import { ArrowUpRight, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import gentabIcon from "../assets/gentab-icon.svg";
import {
  getGenTabTypeLabel,
  normalizeGenTabPreferredType,
  type GenTabPreferredType,
  type GenTabType,
} from "../lib/gentab-types";
import { cn } from "../lib/utils";
import { useGenTabSurfaceState } from "../application/use-gentab-surface-state";
import { useUiPreferences } from "../application/use-ui-preferences";
import { gentabRenderers } from "./gentab-renderers";

const genTabViewTypes: GenTabType[] = ["comparison", "table", "timeline", "list", "card-grid"];

export function GenTabSurface(props: {
  url: string;
  onCloseGenTab?: (genTabId: string) => void;
}) {
  const { onCloseGenTab, url } = props;
  const {
    preferences: { uiLocale },
    t,
  } = useUiPreferences();
  const {
    activeView,
    beginGeneration,
    handleCancel,
    pendingMetadata,
    preferredType,
    refineIntent,
    setActiveView,
    setPreferredType,
    setRefineIntent,
    sourceCards,
    state,
  } = useGenTabSurfaceState({
    url,
    onCloseGenTab,
  });

  const activeRenderer =
    gentabRenderers[(activeView as GenTabType) || "table"] || gentabRenderers.table;

  return (
    <div className="surface-screen absolute inset-0 overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-white/10 bg-gradient-to-br from-apple-pink/18 to-orange-400/12 shadow-[0_0_18px_rgba(255,45,85,0.14)]">
              <img src={gentabIcon} className="h-7 w-7" alt="GenTab" />
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/42">
                  GenTab
                </span>
                {state.gentab ? (
                  <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/52">
                    {getGenTabTypeLabel(
                      uiLocale,
                      normalizeGenTabPreferredType(state.gentab.metadata.preferredType) === "auto"
                        ? state.gentab.type
                        : normalizeGenTabPreferredType(state.gentab.metadata.preferredType),
                    )}
                  </span>
                ) : null}
                {state.gentab ? (
                  <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/42">
                    {t("gentab.sourceTabsCount", {
                      count: state.gentab.metadata.sourceTabIds.length,
                    })}
                  </span>
                ) : null}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                {state.gentab?.title || t("gentab.defaultTitle")}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/45">
                {state.status === "done" && state.gentab?.description
                  ? state.gentab.description
                  : t("gentab.defaultDescription")}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {state.status === "done" ? (
              <button
                onClick={() => beginGeneration()}
                className="surface-button-system inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>{t("gentab.regenerate")}</span>
              </button>
            ) : null}
            <button
              onClick={handleCancel}
              className="surface-button-system inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              <span>{t("common.close")}</span>
            </button>
          </div>
        </div>

        {state.status === "generating" ? (
          <div className="surface-panel rounded-[28px] border p-8 text-center">
            <div className="mx-auto flex max-w-xl flex-col items-center gap-5 py-10">
              <Loader2 className="h-12 w-12 animate-spin text-apple-pink opacity-70" />
              <div className="space-y-3">
                <div className="text-lg font-medium text-white/88">
                  {t("gentab.generatingTitle")}
                </div>
                <p className="text-sm leading-6 text-white/42">
                  {t("gentab.generatingDescription")}
                </p>
              </div>
              <div className="w-full max-w-sm overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-2 rounded-full bg-apple-pink transition-all duration-500"
                  style={{ width: `${state.progress}%` }}
                />
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-left text-[12px] leading-6 text-white/44">
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/26">{t("gentab.currentGoal")}</div>
                <div className="mt-1 text-white/62">
                  {pendingMetadata?.userIntent || t("gentab.defaultIntent")}
                </div>
              </div>
              <button
                onClick={handleCancel}
                className="text-xs text-white/38 transition-colors hover:text-white/68"
              >
                {t("gentab.cancelGeneration")}
              </button>
            </div>
          </div>
        ) : null}

        {state.status === "error" ? (
          <div className="surface-panel rounded-[28px] border p-8">
            <div className="mx-auto flex max-w-lg flex-col items-center gap-5 py-8 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-apple-pink/15 bg-apple-pink/10">
                <img src={gentabIcon} className="h-10 w-10" alt="GenTab" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-white">{t("gentab.errorTitle")}</h3>
                <p className="text-sm leading-6 text-white/42">{state.error}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => beginGeneration()}
                  className="surface-button-ai rounded-xl px-4 py-2 text-sm font-medium"
                >
                  {t("common.retry")}
                </button>
                <button
                  onClick={handleCancel}
                  className="surface-button-system rounded-xl border px-4 py-2 text-sm font-medium"
                >
                  {t("common.close")}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {state.status === "done" && state.gentab ? (
          <>
            <div className="grid gap-6 xl:grid-cols-[1.45fr_0.9fr]">
              <div className="surface-panel rounded-[28px] border p-6">
                <div className="mb-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-white/28">
                  <Sparkles className="h-3.5 w-3.5 text-apple-pink/80" />
                  {t("gentab.summaryHeading")}
                </div>
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
                    <div className="text-[11px] text-white/32">{t("gentab.goalLabel")}</div>
                    <div className="mt-1 text-sm leading-6 text-white/72">
                      {state.gentab.metadata.userIntent}
                    </div>
                  </div>
                  {state.gentab.summary ? (
                    <p className="text-[15px] leading-7 text-white/82">{state.gentab.summary}</p>
                  ) : null}
                  {state.gentab.insights && state.gentab.insights.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {state.gentab.insights.map((insight, index) => (
                        <span
                          key={`${insight}-${index}`}
                          className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/62"
                        >
                          {insight}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="surface-panel rounded-[28px] border p-6">
                <div className="mb-4 text-[10px] uppercase tracking-[0.18em] text-white/28">
                  {t("gentab.refineHeading")}
                </div>
                <textarea
                  value={refineIntent}
                  onChange={(event) => setRefineIntent(event.target.value)}
                  rows={4}
                  className="min-h-[120px] w-full rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-[13px] leading-6 text-white/82 placeholder:text-white/28 focus:outline-none"
                  placeholder={t("gentab.refinePlaceholder")}
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  {(["auto", ...genTabViewTypes] as GenTabPreferredType[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setPreferredType(option)}
                      className={cn(
                        "surface-pill inline-flex h-8 items-center rounded-full border px-3 text-[11px] font-medium transition-colors",
                        preferredType === option ? "surface-pill-active" : "text-white/52",
                      )}
                    >
                      {getGenTabTypeLabel(uiLocale, option)}
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="text-[11px] leading-5 text-white/34">
                    {t("gentab.refineHint")}
                  </div>
                  <button
                    type="button"
                    onClick={() => beginGeneration(refineIntent, preferredType)}
                    disabled={!refineIntent.trim()}
                    className="surface-button-ai inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>{t("gentab.recompose")}</span>
                  </button>
                </div>
                {state.gentab.suggestedPrompts && state.gentab.suggestedPrompts.length > 0 ? (
                  <div className="mt-4 border-t border-white/6 pt-4">
                    <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/24">
                      {t("gentab.suggestedNext")}
                    </div>
                    <div className="space-y-2">
                      {state.gentab.suggestedPrompts.slice(0, 3).map((prompt, index) => (
                        <button
                          key={`${prompt}-${index}`}
                          type="button"
                          onClick={() => setRefineIntent(prompt)}
                          className="flex w-full items-start justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3 text-left text-[12px] leading-5 text-white/58 transition-colors hover:bg-white/[0.05] hover:text-white/78"
                        >
                          <span>{prompt}</span>
                          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/28" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {sourceCards.length > 0 ? (
              <div className="surface-panel rounded-[28px] border p-6">
                <div className="mb-4 text-[10px] uppercase tracking-[0.18em] text-white/28">
                  {t("gentab.sourcesHeading")}
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {sourceCards.map((source) => (
                    <button
                      key={source.url}
                      type="button"
                      onClick={() => window.sabrinaDesktop!.browser.openUrlInNewTab(source.url)}
                      className="group rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-left transition-colors hover:bg-white/[0.05]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-white/82">{source.title}</div>
                          {source.host ? (
                            <div className="mt-1 text-[11px] text-white/34">{source.host}</div>
                          ) : null}
                        </div>
                        <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-white/24 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </div>
                      {source.whyIncluded ? (
                        <div className="mt-3 text-[12px] leading-5 text-white/46">{source.whyIncluded}</div>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {state.gentab.sections && state.gentab.sections.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {state.gentab.sections.map((section) => (
                  <div
                    key={section.id}
                    className="surface-panel rounded-[24px] border p-5"
                  >
                    <div className="text-sm font-semibold text-white/86">{section.title}</div>
                    {section.description ? (
                      <p className="mt-2 text-sm leading-6 text-white/46">{section.description}</p>
                    ) : null}
                    <div className="mt-4 space-y-2">
                      {section.bullets.map((bullet, index) => (
                        <div
                          key={`${section.id}:${index}`}
                          className="rounded-2xl border border-white/6 bg-white/[0.025] px-3 py-2 text-[12px] leading-5 text-white/62"
                        >
                          {bullet}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="surface-panel rounded-[28px] border p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-white/28">{t("gentab.workViewHeading")}</div>
                  <div className="mt-1 text-sm text-white/44">
                    {t("gentab.workViewDescription")}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {genTabViewTypes.map((viewType) => (
                    <button
                      key={viewType}
                      type="button"
                      onClick={() => setActiveView(viewType)}
                      className={cn(
                        "surface-pill inline-flex h-8 items-center rounded-full border px-3 text-[11px] font-medium transition-colors",
                        activeView === viewType ? "surface-pill-active" : "text-white/52",
                      )}
                    >
                      {getGenTabTypeLabel(uiLocale, viewType)}
                    </button>
                  ))}
                </div>
              </div>
              {activeRenderer.render({
                gentab: state.gentab,
                uiLocale,
                onNavigate: (targetUrl) => {
                  window.sabrinaDesktop!.browser.openUrlInNewTab(targetUrl);
                },
              })}
            </div>

            <div className="border-t border-white/5 px-1 pt-1 text-xs text-white/28">
              {t("gentab.generatedMeta", {
                count: state.gentab.metadata.sourceTabIds.length,
                time: new Date(state.gentab.metadata.generatedAt).toLocaleString(uiLocale),
              })}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
