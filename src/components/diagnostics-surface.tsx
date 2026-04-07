import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Check,
  Copy,
  FolderOpen,
  HardDriveDownload,
} from "lucide-react";
import { formatDiagnosticsAgo } from "../application/use-diagnostics-view-state";
import { useDiagnosticsViewState } from "../application/use-diagnostics-view-state";
import { useUiPreferences } from "../application/use-ui-preferences";
import {
  DiagnosticsFocusRow,
  DiagnosticsLogEntryCard,
  DiagnosticsLogFilters,
  DiagnosticsNetworkRow,
  DiagnosticsSummarySection,
} from "./diagnostics-parts";

function formatCompactTimestamp(value: string | null, locale: string, emptyLabel: string) {
  if (!value) {
    return emptyLabel;
  }

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return value;
  }

  return timestamp.toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateValue(value: string | null | undefined, emptyLabel: string, limit = 44) {
  const normalizedValue = `${value ?? ""}`.trim();
  if (!normalizedValue) {
    return emptyLabel;
  }

  return normalizedValue.length > limit
    ? `...${normalizedValue.slice(-limit)}`
    : normalizedValue;
}

type DiagnosticsPriorityItem =
  | {
      kind: "entry";
      id: string;
      timestamp: string;
      entry: SabrinaDiagnosticsEntry;
    }
  | {
      kind: "network";
      id: string;
      timestamp: string;
      event: SabrinaNetworkEvent;
    };

async function copyTextToClipboard(text: string) {
  if (window.navigator.clipboard?.writeText) {
    await window.navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error("copy failed");
  }
}

export function DiagnosticsSurface(props: {
  state: SabrinaDiagnosticsState | null;
  connectionState: SabrinaOpenClawConnectionState | null;
  skillCatalog: SabrinaOpenClawSkillCatalog | null;
  doctorReport: SabrinaOpenClawDoctorReport | null;
  turnJournalStats: SabrinaTurnJournalStats | null;
  browserMemoryStats: SabrinaBrowserMemoryStats | null;
  onRefresh: () => void;
  onOpenLogDirectory: () => void;
  onRevealHumanLogFile: () => void;
}) {
  const {
    state,
    connectionState,
    skillCatalog,
    doctorReport,
    turnJournalStats,
    browserMemoryStats,
    onRefresh,
    onOpenLogDirectory,
    onRevealHumanLogFile,
  } = props;
  const {
    preferences: { uiLocale },
    t,
  } = useUiPreferences();
  const [copyState, setCopyState] = useState<"idle" | "done" | "error">("idle");
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

  useEffect(() => {
    if (copyState === "idle") {
      return;
    }

    const timeout = window.setTimeout(() => setCopyState("idle"), 1600);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  const priorityItems = useMemo<DiagnosticsPriorityItem[]>(
    () =>
      [...focusEntries.map((entry) => ({
        kind: "entry" as const,
        id: entry.id,
        timestamp: entry.timestamp,
        entry,
      })), ...failedNetworkEvents.map((event) => ({
        kind: "network" as const,
        id: `${event.id}-${event.timestamp}`,
        timestamp: event.timestamp,
        event,
      }))]
        .sort(
          (left, right) =>
            new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
        )
        .slice(0, 5),
    [failedNetworkEvents, focusEntries],
  );

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
  const hiddenIssueCount = Math.max(
    0,
    focusEntries.length + failedNetworkEvents.length - priorityItems.length,
  );
  const contractWarnings = (doctorReport?.checks ?? []).filter(
    (check) => check.status === "fail" || check.status === "warn",
  );
  const capabilitySourceCounts = skillCatalog?.summary?.capabilitySourceCounts ?? null;
  const remoteContract = connectionState?.remoteSessionContract ?? null;
  const notAvailableLabel = t("diagnostics.notAvailable");

  const diagnosticsSummary = [
    `${t("diagnostics.title")}: ${healthTone?.title ?? "-"}`,
    t("diagnostics.uptime", { minutes: Math.round(summary.uptimeSec / 60) }),
    `App ${summary.appVersion} · Electron ${summary.electronVersion} · Chrome ${summary.chromeVersion}`,
    `${t("diagnostics.browser")}: ${summary.counters.error} / ${summary.counters.warn}`,
    `${t("diagnostics.network")}: ${summary.counters.networkFailures}`,
    `${t("diagnostics.ai")}: ${summary.ai.failure}`,
    `${t("diagnostics.tabs")}: ${t("diagnostics.currentTabs", { count: summary.browser.tabCount })}`,
    summary.browser.activeTabUrl || t("diagnostics.noActiveTab"),
    "",
    `${t("diagnostics.contract")}:`,
    `- ${t("diagnostics.contractTransport")}: ${connectionState?.transportLabel ?? notAvailableLabel} · v${remoteContract?.contractVersion ?? notAvailableLabel} · ${t("diagnostics.contractFeatureCount", { count: remoteContract?.features?.length ?? 0 })}`,
    `- ${t("diagnostics.contractCapabilities")}: ${t("diagnostics.contractDeclared", { count: capabilitySourceCounts?.declared ?? 0 })} · ${t("diagnostics.contractOverlay", { count: capabilitySourceCounts?.overlay ?? 0 })} · ${t("diagnostics.contractHeuristic", { count: capabilitySourceCounts?.heuristic ?? 0 })}`,
    `- ${t("diagnostics.contractTurns")}: ${t("diagnostics.contractTurnsCount", { count: turnJournalStats?.count ?? 0 })} · ${t("diagnostics.contractLatestStatus", { status: turnJournalStats?.latestStatus ?? notAvailableLabel })}`,
    `- ${t("diagnostics.contractMemory")}: ${t("diagnostics.contractRecordsCount", { count: browserMemoryStats?.count ?? 0 })} · ${t("diagnostics.contractLatestStatus", { status: browserMemoryStats?.latestCapturedAt ?? notAvailableLabel })}`,
    "",
    `${t("diagnostics.recentIssues")}:`,
    ...(priorityItems.length > 0
      ? priorityItems.map((item) =>
          item.kind === "entry"
            ? `- [${item.entry.level.toUpperCase()}] ${item.entry.message} · ${formatDiagnosticsAgo(item.entry.timestamp, uiLocale)}`
            : `- [${item.event.phase.toUpperCase()}] ${item.event.method} ${item.event.url} · ${
                item.event.statusCode ? `HTTP ${item.event.statusCode}` : item.event.error || t("diagnostics.noStatusCode")
              } · ${formatDiagnosticsAgo(item.event.timestamp, uiLocale)}`,
        )
      : [`- ${t("diagnostics.noPriorityIssues")}`]),
  ].join("\n");

  const copyButtonLabel =
    copyState === "done"
      ? t("diagnostics.copySummaryDone")
      : copyState === "error"
        ? t("diagnostics.copySummaryError")
        : t("diagnostics.copySummary");

  const handleCopySummary = async () => {
    try {
      await copyTextToClipboard(diagnosticsSummary);
      setCopyState("done");
    } catch (error) {
      console.error("copy diagnostics summary failed", error);
      setCopyState("error");
    }
  };

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
              <h2 className="text-lg font-semibold text-white">{t("diagnostics.contract")}</h2>
              <p className="mt-1 text-sm text-white/45">
                {t("diagnostics.contractSubtitle")}
              </p>
            </div>
          </div>

          {!connectionState && !skillCatalog && !turnJournalStats && !browserMemoryStats ? (
            <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/4 px-4 py-10 text-center text-sm text-white/45">
              {t("diagnostics.contractUnavailable")}
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                    {t("diagnostics.contractTransport")}
                  </div>
                  <div className="mt-2 text-sm text-white/80">
                    {connectionState?.transportLabel ?? notAvailableLabel}
                  </div>
                  <div className="mt-1 text-xs text-white/45">
                    v{remoteContract?.contractVersion ?? notAvailableLabel} · {remoteContract?.driver ?? notAvailableLabel}
                  </div>
                  <div className="mt-1 text-xs text-white/45">
                    {t("diagnostics.contractFeatureCount", { count: remoteContract?.features?.length ?? 0 })}
                  </div>
                  <div className="mt-1 text-xs text-white/45">
                    {remoteContract?.sshTarget
                      ? `ssh ${remoteContract.sshTarget}${remoteContract.sshPort ? `:${remoteContract.sshPort}` : ""}`
                      : remoteContract?.relayUrl
                        ? truncateValue(remoteContract.relayUrl, notAvailableLabel, 32)
                        : truncateValue(remoteContract?.stateDir ?? connectionState?.stateDir, notAvailableLabel, 32)}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                    {t("diagnostics.contractCapabilities")}
                  </div>
                  <div className="mt-2 text-sm text-white/80">
                    {skillCatalog
                      ? t("diagnostics.contractReadyCount", {
                          ready: skillCatalog.summary.ready,
                          total: skillCatalog.summary.total,
                        })
                      : notAvailableLabel}
                  </div>
                  <div className="mt-1 text-xs text-white/45">
                    {t("diagnostics.contractSchemaVersion", {
                      version: skillCatalog?.summary?.browserCapabilitySchemaVersion ?? notAvailableLabel,
                    })}
                  </div>
                  <div className="mt-1 text-xs text-white/45">
                    {t("diagnostics.contractDeclared", { count: capabilitySourceCounts?.declared ?? 0 })} · {t("diagnostics.contractMetadata", { count: capabilitySourceCounts?.metadata ?? 0 })}
                  </div>
                  <div className="mt-1 text-xs text-white/45">
                    {t("diagnostics.contractOverlay", { count: capabilitySourceCounts?.overlay ?? 0 })} · {t("diagnostics.contractHeuristic", { count: capabilitySourceCounts?.heuristic ?? 0 })}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                    {t("diagnostics.contractTurns")}
                  </div>
                  <div className="mt-2 text-sm text-white/80">
                    {turnJournalStats
                      ? t("diagnostics.contractTurnsCount", { count: turnJournalStats.count })
                      : notAvailableLabel}
                  </div>
                  <div className="mt-1 text-xs text-white/45">
                    {t("diagnostics.contractLatestStatus", {
                      status: turnJournalStats?.latestStatus ?? notAvailableLabel,
                    })}
                  </div>
                  <div className="mt-1 text-xs text-white/45">
                    {formatCompactTimestamp(turnJournalStats?.latestCreatedAt ?? null, uiLocale, notAvailableLabel)}
                  </div>
                  <div className="mt-1 text-xs text-white/45">
                    {t("diagnostics.contractBlockedFailed", {
                      blocked: turnJournalStats?.statusCounts.blocked ?? 0,
                      failed: turnJournalStats?.statusCounts.failed ?? 0,
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                    {t("diagnostics.contractMemory")}
                  </div>
                  <div className="mt-2 text-sm text-white/80">
                    {browserMemoryStats
                      ? t("diagnostics.contractRecordsCount", { count: browserMemoryStats.count })
                      : notAvailableLabel}
                  </div>
                  <div className="mt-1 text-xs text-white/45">
                    {formatCompactTimestamp(browserMemoryStats?.latestCapturedAt ?? null, uiLocale, notAvailableLabel)}
                  </div>
                  <div className="mt-1 text-xs text-white/45">
                    {truncateValue(browserMemoryStats?.path, notAvailableLabel, 32)}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-white">
                      {t("diagnostics.contractDoctor")}
                    </h3>
                    <p className="mt-1 text-xs text-white/45">
                      {doctorReport
                        ? t("diagnostics.contractDoctorCounts", {
                            fail: doctorReport.failureCount,
                            warn: doctorReport.warningCount,
                          })
                        : t("diagnostics.contractDoctorMissing")}
                    </p>
                  </div>
                  {doctorReport ? (
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                      {connectionState?.transportLabel ?? doctorReport.transportLabel}
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 space-y-2">
                  {!doctorReport ? (
                    <div className="text-sm text-white/40">
                      {t("diagnostics.contractDoctorMissing")}
                    </div>
                  ) : contractWarnings.length === 0 ? (
                    <div className="text-sm text-green-300">
                      {t("diagnostics.contractDoctorClean")}
                    </div>
                  ) : (
                    contractWarnings.slice(0, 3).map((check) => (
                      <div
                        key={check.id}
                        className="rounded-xl border border-white/10 bg-black/20 px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm text-white/85">{check.label}</div>
                          <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">
                            {check.status}
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-white/45">{check.detail}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-black/30 p-6 backdrop-blur-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">{t("diagnostics.recentIssues")}</h2>
              <p className="mt-1 text-sm text-white/45">{t("diagnostics.recentIssuesSubtitle")}</p>
            </div>
            <button
              onClick={handleCopySummary}
              className="surface-button-system inline-flex items-center justify-center gap-2 self-start rounded-full border px-4 py-2.5 text-sm font-medium transition"
            >
              {copyState === "done" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copyButtonLabel}
            </button>
          </div>

          {!hasFocusIssues ? (
            <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/4 px-4 py-10 text-center text-sm text-white/45">
              {t("diagnostics.noPriorityIssues")}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {priorityItems.map((item) =>
                item.kind === "entry" ? (
                  <DiagnosticsFocusRow key={item.id} entry={item.entry} />
                ) : (
                  <DiagnosticsNetworkRow key={item.id} event={item.event} />
                ),
              )}
            </div>
          )}

          {hiddenIssueCount > 0 ? (
            <div className="mt-4 text-xs text-white/35">
              {t("diagnostics.moreIssuesHint", { count: hiddenIssueCount })}
            </div>
          ) : null}
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
