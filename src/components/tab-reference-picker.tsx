import { Check, Globe2, Search } from "lucide-react";
import type { SabrinaTabReferenceCandidate } from "../application/sabrina-openclaw";
import { useUiPreferences } from "../application/use-ui-preferences";
import { cn } from "../lib/utils";

export function TabReferencePicker(props: {
  query: string;
  selectedIds: string[];
  tabs: SabrinaTabReferenceCandidate[];
  onChangeQuery?: (value: string) => void;
  onToggleTab?: (id: string) => void;
}) {
  const { onChangeQuery, onToggleTab, query, selectedIds, tabs } = props;
  const { t } = useUiPreferences();
  const normalizedQuery = query.trim().toLowerCase();
  const visibleTabs = tabs.filter((tab) => {
    if (!normalizedQuery) {
      return true;
    }

    return [tab.title, tab.host, tab.url]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });

  return (
    <section className="surface-panel border rounded-[24px] p-4 flex min-h-0 flex-col gap-4">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/34">
          {t("sidebar.references")}
        </p>
        <label className="surface-input flex h-11 items-center gap-3 rounded-2xl border px-3">
          <Search className="h-4 w-4 text-white/34" />
          <input
            value={query}
            onChange={(event) => onChangeQuery?.(event.target.value)}
            placeholder={
              t("language.option.en-US") === "English"
                ? t("common.search")
                : undefined
            }
            className="w-full bg-transparent text-sm text-white/80 placeholder:text-white/30 focus:outline-none"
          />
        </label>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {visibleTabs.map((tab) => {
          const selected = selectedIds.includes(tab.id);
          const available = tab.sourceAvailability?.canReference ?? true;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (!available) {
                  return;
                }
                onToggleTab?.(tab.id);
              }}
              disabled={!available}
              className={cn(
                "surface-card-selectable flex items-center gap-3 rounded-[20px] border px-3 py-3 text-left transition-colors",
                selected && "surface-card-selectable-active",
                !available && "cursor-not-allowed opacity-60",
              )}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/8 text-white/56">
                {tab.favicon ? (
                  <img src={tab.favicon} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Globe2 className="h-4 w-4" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white/86">{tab.title}</p>
                <p className="truncate text-[12px] text-white/40">{tab.host}</p>
                {!available ? (
                  <p className="truncate pt-1 text-[11px] text-white/30">
                    {tab.sourceAvailability?.label}
                  </p>
                ) : null}
              </div>

              <div
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                  selected
                    ? "border-white/20 bg-white/12 text-white"
                    : "border-white/10 text-transparent",
                )}
              >
                <Check className="h-3 w-3" />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
