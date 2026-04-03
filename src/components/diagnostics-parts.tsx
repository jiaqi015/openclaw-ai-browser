import { Search, TriangleAlert, Wifi, Bot } from "lucide-react";
import {
  formatDiagnosticsAgo,
  formatDiagnosticsDuration,
} from "../application/use-diagnostics-view-state";
import { useUiPreferences } from "../application/use-ui-preferences";
import { cn } from "../lib/utils";

export function DiagnosticsStatusCard(props: {
  icon: typeof TriangleAlert;
  label: string;
  value: string;
  note: string;
}) {
  const { icon: Icon, label, note, value } = props;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2 text-white/45">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] font-medium uppercase tracking-[0.2em]">
          {label}
        </span>
      </div>
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs leading-5 text-white/45">{note}</div>
    </div>
  );
}

export function DiagnosticsFocusRow(props: {
  entry: SabrinaDiagnosticsEntry;
}) {
  const { entry } = props;
  const {
    preferences: { uiLocale },
  } = useUiPreferences();
  const levelClass =
    entry.level === "error"
      ? "bg-red-500/15 text-red-200"
      : "bg-amber-500/15 text-amber-200";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
            levelClass,
          )}
        >
          {entry.level}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-white">{entry.message}</div>
          <div className="mt-1 text-xs text-white/45">
            {entry.scope} · {entry.source} · {formatDiagnosticsAgo(entry.timestamp, uiLocale)}
          </div>
          {entry.url ? (
            <div className="mt-2 truncate text-xs text-white/35">{entry.url}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function DiagnosticsNetworkRow(props: {
  event: SabrinaNetworkEvent;
}) {
  const { event } = props;
  const {
    preferences: { uiLocale },
    t,
  } = useUiPreferences();
  const toneClass =
    event.phase === "failed" || (event.statusCode ?? 0) >= 500
      ? "bg-red-500/15 text-red-200"
      : "bg-amber-500/15 text-amber-200";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
            toneClass,
          )}
        >
          {event.phase}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-white">{event.url}</div>
          <div className="mt-1 text-xs text-white/45">
            {event.method} · {event.resourceType} ·{" "}
            {event.statusCode ? `HTTP ${event.statusCode}` : event.error || t("diagnostics.noStatusCode")} ·{" "}
            {formatDiagnosticsAgo(event.timestamp, uiLocale)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DiagnosticsLogEntryCard(props: {
  entry: SabrinaDiagnosticsEntry;
}) {
  const { entry } = props;
  const {
    preferences: { uiLocale },
  } = useUiPreferences();

  return (
    <details className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <summary className="cursor-pointer list-none">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "mt-0.5 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
              entry.level === "error"
                ? "bg-red-500/15 text-red-200"
                : entry.level === "warn"
                  ? "bg-amber-500/15 text-amber-200"
                  : "bg-emerald-500/15 text-emerald-200",
            )}
          >
            {entry.level}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-white">
              {entry.message}
            </div>
            <div className="mt-1 text-xs text-white/45">
              {entry.scope} · {entry.source} · {formatDiagnosticsAgo(entry.timestamp, uiLocale)}
            </div>
          </div>
        </div>
      </summary>

      {entry.url ? (
        <div className="mt-3 truncate text-xs text-white/40">
          {entry.url}
        </div>
      ) : null}

      {entry.details ? (
        <pre className="mt-3 overflow-x-auto rounded-2xl bg-black/35 p-3 text-[11px] leading-6 text-white/55">
          {JSON.stringify(entry.details, null, 2)}
        </pre>
      ) : null}
    </details>
  );
}

export function DiagnosticsSummarySection(props: {
  healthTone: {
    title: string;
    description: string;
    badgeClass: string;
  };
  summary: SabrinaDiagnosticsState["summary"];
}) {
  const { healthTone, summary } = props;
  const { t } = useUiPreferences();

  return (
    <section className="surface-panel rounded-3xl border p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
              healthTone.badgeClass,
            )}
          >
            {healthTone.title}
          </div>
          <p className="mt-3 text-sm text-white/55">{healthTone.description}</p>
        </div>

        <div className="text-sm text-white/40">{t("diagnostics.uptime", { minutes: Math.round(summary.uptimeSec / 60) })}</div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <DiagnosticsStatusCard
          icon={TriangleAlert}
          label={t("diagnostics.browser")}
          value={`${summary.counters.error}`}
          note={t("diagnostics.browserNote", {
            error: summary.counters.error,
            warn: summary.counters.warn,
          })}
        />
        <DiagnosticsStatusCard
          icon={Wifi}
          label={t("diagnostics.network")}
          value={`${summary.counters.networkFailures}`}
          note={t("diagnostics.networkNote", { count: summary.counters.networkFailures })}
        />
        <DiagnosticsStatusCard
          icon={Bot}
          label={t("diagnostics.ai")}
          value={`${summary.ai.failure}`}
          note={t("diagnostics.aiNote", {
            duration: formatDiagnosticsDuration(summary.ai.avgDurationMs),
          })}
        />
      </div>
    </section>
  );
}

export function DiagnosticsLogFilters(props: {
  levelFilter: "all" | "error" | "warn" | "info";
  onChangeLevelFilter: (level: "all" | "error" | "warn" | "info") => void;
  onChangeQuery: (value: string) => void;
  query: string;
}) {
  const { levelFilter, onChangeLevelFilter, onChangeQuery, query } = props;
  const { t } = useUiPreferences();

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap gap-2">
        {(["all", "error", "warn", "info"] as const).map((level) => (
          <button
            key={level}
            onClick={() => onChangeLevelFilter(level)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition",
              levelFilter === level
                ? "bg-white text-black"
                : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            {level === "all" ? t("skills.filter.all") : level.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="relative w-full md:max-w-sm">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          value={query}
          onChange={(event) => onChangeQuery(event.target.value)}
          placeholder={t("diagnostics.searchLogs")}
          className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/20 focus:bg-white/8"
        />
      </div>
    </div>
  );
}
