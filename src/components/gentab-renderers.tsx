import type { JSX } from "react";
import type { GenTabData, GenTabItem } from "../lib/gentab-types";
import { cn } from "../lib/utils";

interface GenTabRendererProps {
  gentab: GenTabData;
  onNavigate: (url: string) => void;
}

interface GenTabRenderer {
  render: (props: GenTabRendererProps) => JSX.Element;
}

function TableRenderer({ gentab, onNavigate }: GenTabRendererProps) {
  if (!gentab.items.length) {
    return (
      <div className="text-center py-12 text-white/40 text-sm">
        没有数据项
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
            <th className="text-left py-3 px-4 text-xs font-medium text-white/60">名称</th>
            {fields.map(field => (
              <th key={field} className="text-left py-3 px-4 text-xs font-medium text-white/60">
                {field}
              </th>
            ))}
            <th className="text-right py-3 px-4 text-xs font-medium text-white/60">来源</th>
          </tr>
        </thead>
        <tbody>
          {gentab.items.map((item, index) => (
            <tr key={item.id} className={cn(
              "border-b border-white/5 hover:bg-white/5 transition-colors",
              index % 2 === 1 ? "bg-white/[0.02]" : ""
            )}>
              <td className="py-3 px-4">
                <div className="font-medium text-white">{item.title}</div>
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
                <button
                  onClick={() => onNavigate(item.sourceUrl)}
                  className="text-xs text-white/68 hover:text-white transition-colors"
                  title={item.sourceTitle}
                >
                  原页面
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListRenderer({ gentab, onNavigate }: GenTabRendererProps) {
  return (
    <div className="space-y-3">
      {gentab.items.map(item => (
        <div
          key={item.id}
          className="rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-medium text-white">{item.title}</h3>
              {item.description && (
                <p className="text-sm text-white/50 mt-1">{item.description}</p>
              )}
            </div>
            <button
              onClick={() => onNavigate(item.sourceUrl)}
              className="shrink-0 text-xs text-white/68 hover:text-white whitespace-nowrap transition-colors"
            >
              查看原页面
            </button>
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
          没有数据项
        </div>
      )}
    </div>
  );
}

function TimelineRenderer({ gentab, onNavigate }: GenTabRendererProps) {
  const sortedItems = [...gentab.items].sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });

  return (
    <div className="space-y-0 relative pl-8 border-l border-white/10">
      {sortedItems.map((item, index) => (
        <div key={item.id} className="relative mb-8 -ml-8">
          <div className="absolute -left-[11px] top-1 w-4 h-4 rounded-full bg-apple-pink border-4 border-[#0a0a0a]" />
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
              <button
                onClick={() => onNavigate(item.sourceUrl)}
                className="shrink-0 text-xs text-white/68 hover:text-white whitespace-nowrap transition-colors"
              >
                原页面
              </button>
            </div>
          </div>
        </div>
      ))}
      {sortedItems.length === 0 && (
        <div className="text-center py-12 text-white/40 text-sm">
          没有时间项
        </div>
      )}
    </div>
  );
}

function CardGridRenderer({ gentab, onNavigate }: GenTabRendererProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {gentab.items.map(item => (
        <div
          key={item.id}
          className="rounded-xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.06] transition-colors"
        >
          <h3 className="font-semibold text-lg text-white">{item.title}</h3>
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
          <div className="mt-4 pt-4 border-t border-white/5">
            <button
              onClick={() => onNavigate(item.sourceUrl)}
              className="w-full rounded-lg bg-white/5 hover:bg-white/10 py-2 text-xs font-medium text-white/70 transition-colors"
            >
              查看原页面：{item.sourceTitle}
            </button>
          </div>
        </div>
      ))}
      {gentab.items.length === 0 && (
        <div className="col-span-full text-center py-12 text-white/40 text-sm">
          没有卡片项
        </div>
      )}
    </div>
  );
}

function ComparisonRenderer({ gentab, onNavigate }: GenTabRendererProps) {
  return (
    <div className="space-y-4">
      {gentab.items.map(item => (
        <div
          key={item.id}
          className="rounded-xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.06] transition-colors"
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <h3 className="font-semibold text-white">{item.title}</h3>
            <button
              onClick={() => onNavigate(item.sourceUrl)}
              className="shrink-0 text-xs text-white/68 hover:text-white whitespace-nowrap transition-colors"
            >
              原页面
            </button>
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
          没有对比项
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
