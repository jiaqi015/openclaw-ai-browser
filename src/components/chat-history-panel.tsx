import { Clock3, Globe2, MessageSquareText, Search } from "lucide-react";
import { useState, useMemo } from "react";
import type { SabrinaThreadSummary } from "../application/sabrina-openclaw";
import { cn } from "../lib/utils";
import { useUiPreferences } from "../application/use-ui-preferences";
import { translate } from "../../shared/localization.mjs";

type GroupedThreads = Record<string, {
  am: SabrinaThreadSummary[];
  pm: SabrinaThreadSummary[];
}>;

function getDateKey(date: Date, uiLocale: "zh-CN" | "en-US"): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return translate(uiLocale, "history.today");
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return translate(uiLocale, "history.yesterday");
  }

  return date.toLocaleDateString(uiLocale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function groupThreadsByDate(
  threads: SabrinaThreadSummary[],
  uiLocale: "zh-CN" | "en-US",
): GroupedThreads {
  const grouped: GroupedThreads = {};

  threads.forEach((thread) => {
    const date = new Date(thread.updatedAt);
    const resolvedDate = Number.isNaN(date.getTime()) ? new Date() : date;
    const dateKey = getDateKey(resolvedDate, uiLocale);
    const isAm = resolvedDate.getHours() < 12;
    const period = isAm ? "am" : "pm";

    if (!grouped[dateKey]) {
      grouped[dateKey] = { am: [], pm: [] };
    }
    grouped[dateKey][period].push(thread);
  });

  return grouped;
}

export function ChatHistoryPanel(props: {
  threads: SabrinaThreadSummary[];
  onSelectThread?: (threadId: string) => void;
}) {
  const { onSelectThread, threads } = props;
  const {
    preferences: { uiLocale },
  } = useUiPreferences();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const visibleThreads = useMemo(() => {
    const filtered = threads.filter((thread) => {
      if (!normalizedQuery) return true;
      return [thread.title, thread.preview, thread.siteLabel, thread.siteHost]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });

    return filtered.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [threads, normalizedQuery]);

  const groupedThreads = useMemo(() => {
    return groupThreadsByDate(visibleThreads, uiLocale);
  }, [uiLocale, visibleThreads]);

  return (
    <aside className="surface-panel border rounded-[26px] p-3 flex min-h-0 flex-col">
      <div className="px-2 pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/34">
          {translate(uiLocale, "history.title")}
        </p>
      </div>

      <div className="pb-2">
        <label className="surface-input flex h-9 items-center gap-3 rounded-2xl border px-3">
          <Search className="h-4 w-4 text-white/34" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={translate(uiLocale, "history.searchPlaceholder")}
            className="w-full bg-transparent text-sm text-white/80 placeholder:text-white/30 focus:outline-none"
          />
        </label>
      </div>

      {visibleThreads.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-6 text-center text-white/34">
          <MessageSquareText className="h-8 w-8" />
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-white/58">
              {translate(uiLocale, "history.emptyTitle")}
            </p>
            <p className="text-[12px] leading-4 text-white/34">
              {translate(uiLocale, "history.emptyDescription")}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
          {Object.entries(groupedThreads).map(([dateKey, { am, pm }]) => (
            <div key={dateKey} className="space-y-1.5">
              <div className="px-1">
                <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider">
                  {dateKey}
                </span>
              </div>
              {am.length > 0 && (
                <div className="space-y-1.5">
                  <div className="px-2">
                    <span className="text-[9px] text-white/30">
                      {translate(uiLocale, "common.morning")}
                    </span>
                  </div>
                  {am.map((thread) => renderThreadCard(thread, uiLocale, onSelectThread))}
                </div>
              )}
              {pm.length > 0 && (
                <div className="space-y-1.5">
                  <div className="px-2">
                    <span className="text-[9px] text-white/30">
                      {translate(uiLocale, "common.afternoon")}
                    </span>
                  </div>
                  {pm.map((thread) => renderThreadCard(thread, uiLocale, onSelectThread))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

function renderThreadCard(
  thread: SabrinaThreadSummary,
  uiLocale: "zh-CN" | "en-US",
  onSelectThread?: (threadId: string) => void,
) {
  return (
    <button
      key={thread.threadId}
      type="button"
      onClick={() => onSelectThread?.(thread.threadId)}
      className={cn(
        "surface-card-selectable w-full rounded-[18px] border px-3 py-2.5 text-left transition-colors",
        thread.active && "surface-card-selectable-active",
      )}
    >
      <div className="space-y-1.5">
        <div className="space-y-0.5">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-sm font-medium leading-5 text-white/88">
              {thread.title}
            </p>
            {thread.status === "error" ? (
              <span className="rounded-full bg-rose-500/14 px-2 py-0.5 text-[10px] text-rose-200 flex-shrink-0">
                  {translate(uiLocale, "common.error")}
                </span>
            ) : null}
          </div>
          {thread.preview ? (
            <p className="line-clamp-2 text-[11px] leading-4 text-white/46">
              {thread.preview}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[10px] text-white/34">
          {(thread.siteLabel || thread.siteHost) ? (
            <span className="inline-flex items-center gap-1">
              <Globe2 className="h-3 w-3" />
              {thread.siteLabel || thread.siteHost}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3 w-3" />
            {thread.updatedAtLabel}
          </span>
        </div>
      </div>
    </button>
  );
}
