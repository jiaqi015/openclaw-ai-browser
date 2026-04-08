import type { JSX } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { translate, type UiLocale } from "../../shared/localization.mjs";
import type { GenTabCellLiveness, GenTabData, GenTabItem } from "../lib/gentab-types";
import { cn } from "../lib/utils";

/**
 * Map of tabId -> current url for tabs that are still open.
 * Used by the renderer to decide if an item's source is still "live".
 */
export type LiveTabMap = Map<string, string>;

interface GenTabRendererProps {
  gentab: GenTabData;
  onNavigate: (url: string) => void;
  uiLocale: UiLocale;
  liveTabMap?: LiveTabMap;
  refreshingItemIds?: Set<string>;
  itemRefreshErrors?: Record<string, string>;
  onRefreshItem?: (itemId: string) => void;
}

/**
 * Normalize a URL for liveness comparison: drop hash, drop trailing slash on
 * the path, ignore casing of host. We don't strip query strings — query
 * params often *are* the page identity (e.g. SPA routes, search results).
 */
function normalizeUrlForCompare(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    let path = parsed.pathname;
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${path}${parsed.search}`;
  } catch {
    return url;
  }
}

export function resolveLiveness(item: GenTabItem, liveTabMap?: LiveTabMap): GenTabCellLiveness {
  if (!item.sourceTabId) {
    // No provenance tabId captured at generation time — we can't track it.
    return "unknown";
  }
  if (!liveTabMap) {
    return "unknown";
  }
  const currentUrl = liveTabMap.get(item.sourceTabId);
  if (!currentUrl) {
    return "closed";
  }
  if (
    item.sourceUrl &&
    normalizeUrlForCompare(currentUrl) !== normalizeUrlForCompare(item.sourceUrl)
  ) {
    return "drifted";
  }
  return "live";
}

// Subdued palette to match the dark glass / Apple-ish system surfaces. We
// avoid drop-shadow halos because they read as "polling status indicator"
// rather than ambient signal.
const livenessStyles: Record<GenTabCellLiveness, { dotClass: string; label: string }> = {
  live: { dotClass: "bg-emerald-300/80", label: "来源仍然活跃" },
  drifted: { dotClass: "bg-amber-300/75", label: "来源标签页已跳转到新地址" },
  closed: { dotClass: "bg-white/22", label: "来源标签页已关闭" },
  unknown: { dotClass: "bg-white/10", label: "未记录来源标签页" },
};

export function LiveCellIndicator({
  item,
  liveTabMap,
  className,
}: {
  item: GenTabItem;
  liveTabMap?: LiveTabMap;
  className?: string;
}) {
  const state = resolveLiveness(item, liveTabMap);
  const style = livenessStyles[state];
  const tooltipLines = [style.label];
  if (item.quote) {
    tooltipLines.push("", `原文片段：${item.quote}`);
  }

  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      title={tooltipLines.join("\n")}
      aria-label={style.label}
    >
      <span className={cn("h-2 w-2 rounded-full transition-colors", style.dotClass)} />
    </span>
  );
}

// Centralized strings — kept here so we can swap to translate() in one place.
const liveCellsStrings = {
  refreshTooltip: "刷新此行：从源标签页重新抽取字段",
  refreshTooltipDrifted: "源标签页已跳转，刷新会从新地址抽取",
  refreshDisabledClosed: "源标签页已关闭，无法刷新",
  refreshDisabledNotTrackable: "未记录源标签页，无法刷新",
  refreshErrorPrefix: "上次刷新失败",
  refreshAriaLabel: "刷新此行",
  quotePrefix: "原文片段",
} as const;

/**
 * Live Cells refresh button for a single GenTab row. Disabled when the row's
 * source tab is not tracked (can't tell the agent which tab to re-read).
 */
export function RefreshItemButton({
  item,
  liveTabMap,
  isRefreshing,
  error,
  onRefreshItem,
  className,
}: {
  item: GenTabItem;
  liveTabMap?: LiveTabMap;
  isRefreshing?: boolean;
  error?: string;
  onRefreshItem?: (itemId: string) => void;
  className?: string;
}) {
  if (!onRefreshItem) {
    return null;
  }

  const liveness = resolveLiveness(item, liveTabMap);
  // Without a sourceTabId we can't ask the backend to re-read a specific tab.
  const notTrackable = !item.sourceTabId;
  // If the source tab has been closed, the backend will fail immediately.
  // We still allow clicking when the tab has drifted to a new URL — that IS
  // a meaningful refresh (pulls fields from whatever the tab shows now).
  const disabled = notTrackable || liveness === "closed" || isRefreshing;

  const tooltipLines: string[] = [];
  if (notTrackable) {
    tooltipLines.push(liveCellsStrings.refreshDisabledNotTrackable);
  } else if (liveness === "closed") {
    tooltipLines.push(liveCellsStrings.refreshDisabledClosed);
  } else if (liveness === "drifted") {
    tooltipLines.push(liveCellsStrings.refreshTooltipDrifted);
  } else {
    tooltipLines.push(liveCellsStrings.refreshTooltip);
  }
  if (error) {
    tooltipLines.push("", `${liveCellsStrings.refreshErrorPrefix}：${error}`);
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onRefreshItem(item.id)}
      title={tooltipLines.join("\n")}
      aria-label={liveCellsStrings.refreshAriaLabel}
      className={cn(
        // Match the visual weight of "查看原页面" buttons next to it: a soft
        // ghost icon button on the same surface tier, no heavy border.
        "inline-flex h-6 w-6 items-center justify-center rounded-md text-white/45 transition-colors",
        "hover:bg-white/[0.07] hover:text-white/80",
        "disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-white/45",
        // Error state: subtle ring, never recolor the icon — we don't want
        // a refresh button to read as "danger".
        error ? "ring-1 ring-amber-300/35" : "",
        className,
      )}
    >
      {isRefreshing ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <RefreshCw className="h-3 w-3" />
      )}
    </button>
  );
}

interface GenTabRenderer {
  render: (props: GenTabRendererProps) => JSX.Element;
}

function TableRenderer({
  gentab,
  onNavigate,
  uiLocale,
  liveTabMap,
  refreshingItemIds,
  itemRefreshErrors,
  onRefreshItem,
}: GenTabRendererProps) {
  if (!gentab.items.length) {
    return (
      <div className="text-center py-12 text-white/40 text-sm">
        {translate(uiLocale, "gentab.render.noDataItems")}
      </div>
    );
  }

  const allFields = new Set<string>();
  gentab.items.forEach(item => {
    Object.keys(item.fields || {}).forEach(field => allFields.add(field));
  });
  const fields = Array.from(allFields);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left py-3 px-4 text-xs font-medium text-white/60">
              {translate(uiLocale, "gentab.render.name")}
            </th>
            {fields.map(field => (
              <th key={field} className="text-left py-3 px-4 text-xs font-medium text-white/60">
                {field}
              </th>
            ))}
            <th className="text-right py-3 px-4 text-xs font-medium text-white/60">
              {translate(uiLocale, "gentab.render.source")}
            </th>
          </tr>
        </thead>
        <tbody>
          {gentab.items.map((item, index) => (
            <tr key={item.id} className={cn(
              "border-b border-white/5 hover:bg-white/5 transition-colors",
              index % 2 === 1 ? "bg-white/[0.02]" : ""
            )}>
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <LiveCellIndicator item={item} liveTabMap={liveTabMap} />
                  <div className="font-medium text-white">{item.title}</div>
                </div>
                {item.description && (
                  <div className="text-xs text-white/40 mt-1">{item.description}</div>
                )}
              </td>
              {fields.map(field => (
                <td key={field} className="py-3 px-4 text-sm text-white/70">
                  {item.fields?.[field] || "-"}
                </td>
              ))}
              <td className="py-3 px-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <RefreshItemButton
                    item={item}
                    liveTabMap={liveTabMap}
                    isRefreshing={refreshingItemIds?.has(item.id)}
                    error={itemRefreshErrors?.[item.id]}
                    onRefreshItem={onRefreshItem}
                  />
                  <button
                    onClick={() => onNavigate(item.sourceUrl)}
                    className="text-xs text-white/68 hover:text-white transition-colors"
                    title={item.sourceTitle}
                  >
                    {translate(uiLocale, "gentab.render.sourcePage")}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListRenderer({
  gentab,
  onNavigate,
  uiLocale,
  liveTabMap,
  refreshingItemIds,
  itemRefreshErrors,
  onRefreshItem,
}: GenTabRendererProps) {
  return (
    <div className="space-y-3">
      {gentab.items.map(item => (
        <div
          key={item.id}
          className="rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <LiveCellIndicator item={item} liveTabMap={liveTabMap} />
                <h3 className="font-medium text-white">{item.title}</h3>
              </div>
              {item.description && (
                <p className="text-sm text-white/50 mt-1">{item.description}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <RefreshItemButton
                item={item}
                liveTabMap={liveTabMap}
                isRefreshing={refreshingItemIds?.has(item.id)}
                error={itemRefreshErrors?.[item.id]}
                onRefreshItem={onRefreshItem}
              />
              <button
                onClick={() => onNavigate(item.sourceUrl)}
                className="text-xs text-white/68 hover:text-white whitespace-nowrap transition-colors"
              >
                {translate(uiLocale, "gentab.render.viewSourcePage")}
              </button>
            </div>
          </div>
          {item.fields && Object.keys(item.fields).length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-2 gap-2">
              {Object.entries(item.fields).map(([key, value]) => (
                <div key={key} className="text-xs">
                  <span className="text-white/40">{key}：</span>
                  <span className="text-white/70 ml-1">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {gentab.items.length === 0 && (
        <div className="text-center py-12 text-white/40 text-sm">
          {translate(uiLocale, "gentab.render.noDataItems")}
        </div>
      )}
    </div>
  );
}

function TimelineRenderer({
  gentab,
  onNavigate,
  uiLocale,
  liveTabMap,
  refreshingItemIds,
  itemRefreshErrors,
  onRefreshItem,
}: GenTabRendererProps) {
  const sortedItems = [...gentab.items].sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });

  return (
    <div className="space-y-0 relative pl-8 border-l border-white/10">
      {sortedItems.map((item) => {
        const liveness = resolveLiveness(item, liveTabMap);
        const livenessLabel = livenessStyles[liveness].label;
        const anchorTone =
          liveness === "live"
            ? "bg-apple-pink"
            : liveness === "drifted"
              ? "bg-amber-300/80"
              : liveness === "closed"
                ? "bg-white/22"
                : "bg-white/14";
        const tooltip = item.quote
          ? `${livenessLabel}\n\n${liveCellsStrings.quotePrefix}：${item.quote}`
          : livenessLabel;
        return (
        <div key={item.id} className="relative mb-8 -ml-8">
          <div
            className={cn(
              "absolute -left-[11px] top-1 w-4 h-4 rounded-full border-4 border-[#0a0a0a] transition-colors",
              anchorTone,
            )}
            title={tooltip}
            aria-label={livenessLabel}
          />
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div>
                {item.date && (
                  <div className="text-xs text-apple-pink/80 font-medium mb-1">{item.date}</div>
                )}
                <h3 className="font-medium text-white">{item.title}</h3>
                {item.description && (
                  <p className="text-sm text-white/50 mt-1">{item.description}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <RefreshItemButton
                  item={item}
                  liveTabMap={liveTabMap}
                  isRefreshing={refreshingItemIds?.has(item.id)}
                  error={itemRefreshErrors?.[item.id]}
                  onRefreshItem={onRefreshItem}
                />
                <button
                  onClick={() => onNavigate(item.sourceUrl)}
                  className="text-xs text-white/68 hover:text-white whitespace-nowrap transition-colors"
                >
                  {translate(uiLocale, "gentab.render.sourcePage")}
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })}
      {sortedItems.length === 0 && (
        <div className="text-center py-12 text-white/40 text-sm">
          {translate(uiLocale, "gentab.render.noTimelineItems")}
        </div>
      )}
    </div>
  );
}

function CardGridRenderer({
  gentab,
  onNavigate,
  uiLocale,
  liveTabMap,
  refreshingItemIds,
  itemRefreshErrors,
  onRefreshItem,
}: GenTabRendererProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {gentab.items.map(item => (
        <div
          key={item.id}
          className="rounded-xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.06] transition-colors"
        >
          <div className="flex items-center gap-2">
            <LiveCellIndicator item={item} liveTabMap={liveTabMap} />
            <h3 className="font-semibold text-lg text-white">{item.title}</h3>
          </div>
          {item.description && (
            <p className="text-sm text-white/50 mt-2">{item.description}</p>
          )}
          {item.fields && Object.keys(item.fields).length > 0 && (
            <div className="mt-4 space-y-1">
              {Object.entries(item.fields).map(([key, value]) => (
                <div key={key} className="flex justify-between text-xs">
                  <span className="text-white/40">{key}</span>
                  <span className="text-white/70 font-medium">{value}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2">
            <button
              onClick={() => onNavigate(item.sourceUrl)}
              className="flex-1 rounded-lg bg-white/5 hover:bg-white/10 py-2 text-xs font-medium text-white/70 transition-colors"
            >
              {translate(uiLocale, "gentab.render.viewSourcePageWithTitle", {
                title: item.sourceTitle,
              })}
            </button>
            <RefreshItemButton
              item={item}
              liveTabMap={liveTabMap}
              isRefreshing={refreshingItemIds?.has(item.id)}
              error={itemRefreshErrors?.[item.id]}
              onRefreshItem={onRefreshItem}
            />
          </div>
        </div>
      ))}
      {gentab.items.length === 0 && (
        <div className="col-span-full text-center py-12 text-white/40 text-sm">
          {translate(uiLocale, "gentab.render.noCardItems")}
        </div>
      )}
    </div>
  );
}

function ComparisonRenderer({
  gentab,
  onNavigate,
  uiLocale,
  liveTabMap,
  refreshingItemIds,
  itemRefreshErrors,
  onRefreshItem,
}: GenTabRendererProps) {
  return (
    <div className="space-y-4">
      {gentab.items.map(item => (
        <div
          key={item.id}
          className="rounded-xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.06] transition-colors"
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <LiveCellIndicator item={item} liveTabMap={liveTabMap} />
              <h3 className="font-semibold text-white">{item.title}</h3>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <RefreshItemButton
                item={item}
                liveTabMap={liveTabMap}
                isRefreshing={refreshingItemIds?.has(item.id)}
                error={itemRefreshErrors?.[item.id]}
                onRefreshItem={onRefreshItem}
              />
              <button
                onClick={() => onNavigate(item.sourceUrl)}
                className="text-xs text-white/68 hover:text-white whitespace-nowrap transition-colors"
              >
                {translate(uiLocale, "gentab.render.sourcePage")}
              </button>
            </div>
          </div>
          {item.description && (
            <p className="text-sm text-white/60 mb-4">{item.description}</p>
          )}
          {item.fields && Object.keys(item.fields).length > 0 && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {Object.entries(item.fields).map(([key, value]) => (
                <div key={key} className="rounded-lg bg-white/[0.04] px-3 py-2">
                  <div className="text-xs text-white/40">{key}</div>
                  <div className="text-sm text-white/75 mt-0.5">{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {gentab.items.length === 0 && (
        <div className="text-center py-12 text-white/40 text-sm">
          {translate(uiLocale, "gentab.render.noComparisonItems")}
        </div>
      )}
    </div>
  );
}

export const gentabRenderers: Record<string, GenTabRenderer> = {
  table: { render: TableRenderer },
  list: { render: ListRenderer },
  timeline: { render: TimelineRenderer },
  "card-grid": { render: CardGridRenderer },
  comparison: { render: ComparisonRenderer },
};
