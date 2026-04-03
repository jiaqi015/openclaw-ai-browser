import { Activity, FolderOpen, HardDriveDownload } from "lucide-react";
import { useDiagnosticsViewState } from "../application/use-diagnostics-view-state";
import { useUiPreferences } from "../application/use-ui-preferences";
import {
  DiagnosticsFocusRow,
  DiagnosticsLogEntryCard,
  DiagnosticsLogFilters,
  DiagnosticsNetworkRow,
  DiagnosticsSummarySection,
} from "./diagnostics-parts";

export function DiagnosticsSurface(props: {
  state: SabrinaDiagnosticsState | null;
  onRefresh: () => void;
  onOpenLogDirectory: () => void;
  onRevealHumanLogFile: () => void;
}) {
  const { state, onRefresh, onOpenLogDirectory, onRevealHumanLogFile } = props;
  const {
    preferences: { uiLocale },
    t,
  } = useUiPreferences();
  const {
    advancedOpen,
    failedNetworkEvents,
    filteredEntries,
    focusEntries,
    hasFocusIssues,
    healthTone,
    levelFilter,
    query,
    setAdvancedOpen,
    setLevelFilter,
    setQuery,
  } = useDiagnosticsViewState(state, uiLocale);

  if (!state) {
    return (
      <div className="surface-screen absolute inset-0 p-10 overflow-y-auto">
        <div className="mx-auto max-w-5xl">
          <div className="surface-panel rounded-3xl border p-8 text-white/60">
            {t("diagnostics.loading")}
          </div>
        </div>
      </div>
    );
  }

  const { summary } = state;

  return (
    <div className="surface-screen absolute inset-0 overflow-y-auto px-6 py-8 md:px-10">
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="surface-panel rounded-3xl border p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-white">{t("diagnostics.title")}</h1>
              <p className="mt-2 text-sm text-white/50">
                {t("diagnostics.subtitle")}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={onRefresh}
                className="surface-button-system inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition"
              >
                <Activity className="h-4 w-4" />
                {t("common.refresh")}
              </button>
              <button
                onClick={onOpenLogDirectory}
                className="surface-button-system inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition"
              >
                <FolderOpen className="h-4 w-4" />
                {t("diagnostics.logDirectory")}
              </button>
              <button
                onClick={onRevealHumanLogFile}
                className="surface-button-system inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition"
              >
                <HardDriveDownload className="h-4 w-4" />
                {t("diagnostics.mainLogFile")}
              </button>
            </div>
          </div>
        </section>

        <DiagnosticsSummarySection healthTone={healthTone!} summary={summary} />

        <section className="rounded-3xl border border-white/10 bg-black/30 p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">{t("diagnostics.recentIssues")}</h2>
              <p className="mt-1 text-sm text-white/45">{t("diagnostics.recentIssuesSubtitle")}</p>
            </div>
            <div className="text-xs text-white/35">
              {t("diagnostics.issueCount", { count: focusEntries.length })}
            </div>
          </div>

          {!hasFocusIssues ? (
            <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/4 px-4 py-10 text-center text-sm text-white/45">
              {t("diagnostics.noPriorityIssues")}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {focusEntries.map((entry) => (
                <DiagnosticsFocusRow key={entry.id} entry={entry} />
              ))}
              {failedNetworkEvents.map((event) => (
                <DiagnosticsNetworkRow key={`${event.id}-${event.timestamp}`} event={event} />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-black/30 p-6 backdrop-blur-xl">
          <button
            onClick={() => setAdvancedOpen((current) => !current)}
            className="flex w-full items-center justify-between text-left"
          >
            <div>
              <h2 className="text-lg font-semibold text-white">{t("diagnostics.advanced")}</h2>
              <p className="mt-1 text-sm text-white/45">
                {t("diagnostics.advancedSubtitle")}
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
              {advancedOpen ? t("common.collapse") : t("common.expand")}
            </span>
          </button>

          {advancedOpen ? (
            <div className="mt-5 space-y-5">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                    {t("diagnostics.version")}
                  </div>
                  <div className="mt-2 text-sm text-white/80">
                    App {summary.appVersion}
                  </div>
                  <div className="mt-1 text-xs text-white/45">
                    Electron {summary.electronVersion} · Chrome {summary.chromeVersion}
                  </div>
                  <div className="mt-1 text-xs text-white/45">
                    Node {summary.nodeVersion}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                    {t("diagnostics.runtime")}
                  </div>
                  <div className="mt-2 text-sm text-white/80">
                    {summary.platform} · {summary.arch}
                  </div>
                  <div className="mt-1 text-xs text-white/45">
                    RSS {summary.memory.formatted.rss}
                  </div>
                  <div className="mt-1 text-xs text-white/45">
                    Heap {summary.memory.formatted.heapUsed} / {summary.memory.formatted.heapTotal}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                    {t("diagnostics.tabs")}
                  </div>
                  <div className="mt-2 text-sm text-white/80">
                    {t("diagnostics.currentTabs", { count: summary.browser.tabCount })}
                  </div>
                  <div className="mt-1 truncate text-xs text-white/45">
                    {summary.browser.activeTabUrl || t("diagnostics.noActiveTab")}
                  </div>
                </div>
              </div>

              <div>
                <DiagnosticsLogFilters
                  levelFilter={levelFilter}
                  onChangeLevelFilter={setLevelFilter}
                  onChangeQuery={setQuery}
                  query={query}
                />

                <div className="mt-4 space-y-3">
                  {filteredEntries.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/4 px-4 py-10 text-center text-sm text-white/45">
                      {t("diagnostics.noLogsMatch")}
                    </div>
                  ) : (
                    filteredEntries
                      .slice(0, 30)
                      .map((entry) => <DiagnosticsLogEntryCard key={entry.id} entry={entry} />)
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
