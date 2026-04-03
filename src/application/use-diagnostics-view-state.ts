import { useMemo, useState } from "react";

export function formatDiagnosticsAgo(timestamp: string) {
  const deltaMs = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(deltaMs)) {
    return "刚刚";
  }

  const seconds = Math.max(0, Math.round(deltaMs / 1000));
  if (seconds < 60) {
    return `${seconds}s 前`;
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m 前`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h 前`;
  }

  return `${Math.round(hours / 24)}d 前`;
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
}) {
  if (props.errorCount > 0 || props.networkFailures > 0 || props.aiFailures > 0) {
    return {
      title: "有异常",
      description: "先看下面“最近问题”里的前几条。",
      badgeClass: "bg-red-500/15 text-red-200 border-red-400/20",
    };
  }

  if (props.warnCount > 0) {
    return {
      title: "需要关注",
      description: "没有明显错误，但有一些告警。",
      badgeClass: "bg-amber-500/15 text-amber-200 border-amber-400/20",
    };
  }

  return {
    title: "运行正常",
    description: "目前没有发现明显异常。",
    badgeClass: "bg-emerald-500/15 text-emerald-200 border-emerald-400/20",
  };
}

export function useDiagnosticsViewState(state: SabrinaDiagnosticsState | null) {
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
      })
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
