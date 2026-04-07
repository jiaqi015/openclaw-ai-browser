import { Search, TriangleAlert, Wifi, Bot, type LucideIcon } from "lucide-react";
import { formatDiagnosticsAgo } from "../application/use-diagnostics-view-state";
import { useUiPreferences } from "../application/use-ui-preferences";
import { cn } from "../lib/utils";

function DiagnosticsCompactMetric(props: {
  icon: LucideIcon;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  const { icon: Icon, label, value, valueClassName } = props;

  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3">
      <div className="flex items-center gap-2 text-white/38">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] font-medium uppercase tracking-[0.18em]">{label}</span>
      </div>
      <div className={cn("mt-2 text-sm font-semibold text-white/90", valueClassName)}>{value}</div>
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
              healthTone.badgeClass,
            )}
          >
            {healthTone.title}
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/58">{healthTone.description}</p>
        </div>

        <div className="inline-flex self-start rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/40">
          {t("diagnostics.uptime", { minutes: Math.round(summary.uptimeSec / 60) })}
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <DiagnosticsCompactMetric
          icon={TriangleAlert}
          label={t("diagnostics.browser")}
          value={t("diagnostics.browserMetric", {
            error: summary.counters.error,
            warn: summary.counters.warn,
          })}
          valueClassName={
            summary.counters.error > 0
              ? "text-red-200"
              : summary.counters.warn > 0
                ? "text-amber-200"
                : undefined
          }
        />
        <DiagnosticsCompactMetric
          icon={Wifi}
          label={t("diagnostics.network")}
          value={t("diagnostics.networkMetric", { count: summary.counters.networkFailures })}
          valueClassName={summary.counters.networkFailures > 0 ? "text-red-200" : undefined}
        />
        <DiagnosticsCompactMetric
          icon={Bot}
          label={t("diagnostics.ai")}
          value={t("diagnostics.aiMetric", { count: summary.ai.failure })}
          valueClassName={summary.ai.failure > 0 ? "text-red-200" : undefined}
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
