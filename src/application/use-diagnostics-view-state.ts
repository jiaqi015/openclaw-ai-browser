import { useMemo, useState } from "react";
import { formatRelativeTimeAgo, translate, type UiLocale } from "../../shared/localization.mjs";

export function formatDiagnosticsAgo(timestamp: string, locale: UiLocale) {
  return formatRelativeTimeAgo(timestamp, locale);
}

export function formatDiagnosticsDuration(durationMs: number | null | undefined) {
  if (!durationMs || durationMs <= 0) {
    return "0 ms";
  }

  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  return `${(durationMs / 1000).toFixed(2)} s`;
}

function sortByNewest<T extends { timestamp: string }>(items: T[]) {
  return [...items].sort(
    (left, right) =>
      new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  );
}

function buildEntryHaystack(entry: SabrinaDiagnosticsEntry) {
  return [
    entry.message,
    entry.scope,
    entry.source,
    entry.url,
    entry.tabId ?? "",
    JSON.stringify(entry.details ?? ""),
  ]
    .join(" ")
    .toLowerCase();
}

export function getDiagnosticsHealthTone(props: {
  errorCount: number;
  warnCount: number;
  networkFailures: number;
  aiFailures: number;
}, locale: UiLocale) {
  if (props.errorCount > 0 || props.networkFailures > 0 || props.aiFailures > 0) {
    return {
      title: translate(locale, "diagnostics.health.error.title"),
      description: translate(locale, "diagnostics.health.error.description"),
      badgeClass: "bg-red-500/15 text-red-200 border-red-400/20",
    };
  }

  if (props.warnCount > 0) {
    return {
      title: translate(locale, "diagnostics.health.warn.title"),
      description: translate(locale, "diagnostics.health.warn.description"),
      badgeClass: "bg-amber-500/15 text-amber-200 border-amber-400/20",
    };
  }

  return {
    title: translate(locale, "diagnostics.health.ok.title"),
    description: translate(locale, "diagnostics.health.ok.description"),
    badgeClass: "bg-emerald-500/15 text-emerald-200 border-emerald-400/20",
  };
}

export function useDiagnosticsViewState(
  state: SabrinaDiagnosticsState | null,
  locale: UiLocale,
) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [levelFilter, setLevelFilter] = useState<"all" | "error" | "warn" | "info">("all");
  const [query, setQuery] = useState("");

  const filteredEntries = useMemo(() => {
    if (!state) {
      return [];
    }

    const keyword = query.trim().toLowerCase();

    return sortByNewest(state.entries).filter((entry) => {
      if (levelFilter !== "all" && entry.level !== levelFilter) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      return buildEntryHaystack(entry).includes(keyword);
    });
  }, [levelFilter, query, state]);

  const focusEntries = useMemo(() => {
    if (!state) {
      return [];
    }

    return sortByNewest(
      state.entries.filter((entry) => entry.level === "error" || entry.level === "warn"),
    ).slice(0, 6);
  }, [state]);

  const failedNetworkEvents = useMemo(() => {
    if (!state) {
      return [];
    }

    return sortByNewest(
      state.network.filter(
        (event) => event.phase === "failed" || (event.statusCode ?? 0) >= 400,
      ),
    ).slice(0, 5);
  }, [state]);

  const summary = state?.summary ?? null;
  const healthTone = summary
    ? getDiagnosticsHealthTone({
        errorCount: summary.counters.error,
        warnCount: summary.counters.warn,
        networkFailures: summary.counters.networkFailures,
        aiFailures: summary.counters.aiFailures,
      }, locale)
    : null;

  return {
    advancedOpen,
    failedNetworkEvents,
    filteredEntries,
    focusEntries,
    hasFocusIssues: focusEntries.length > 0 || failedNetworkEvents.length > 0,
    healthTone,
    levelFilter,
    query,
    setAdvancedOpen,
    setLevelFilter,
    setQuery,
  };
}
