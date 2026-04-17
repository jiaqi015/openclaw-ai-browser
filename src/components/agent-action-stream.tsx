import React, { useEffect, useRef } from "react";
import { AgentActionEntry } from "../application/use-browser-agent-state";
import { translate, type UiLocale } from "../../shared/localization.mjs";
import { useUiPreferences } from "../application/use-ui-preferences";

interface AgentActionStreamProps {
  journal: AgentActionEntry[];
  status: string;
  warnings?: string[];
  taskTree?: any[]; // V9: 新增任务树支持
  pendingConfirm: any;
  onConfirm: (confirmed: boolean) => void;
  onStop: () => void;
}

// ── Status Labels ─────────────────────────────────────────────────────────
const STATUS_STEP_LABELS: Record<string, string> = {
  observe: "观察页面",
  think: "分析决策",
  "action-start": "执行操作",
  "action-success": "操作成功",
  "action-error": "操作失败",
  "verify-start": "后置校验",
  "verify-success": "校验通过",
  "verify-fail": "校验失败",
  done: "任务完成",
  error: "任务中止",
};

// ── Live Status Progress Bar (shown while running) ────────────────────────
function AgentLiveBanner({ status, stepCount }: { status: string; stepCount: number }) {
  if (status !== "running") return null;
  return (
    <div className="flex flex-col gap-2">
      {/* Glowing header */}
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#FF2D55]/10 border border-[#FF2D55]/25 shadow-[0_0_20px_rgba(255,45,85,0.08)]">
        <div className="relative flex items-center justify-center w-7 h-7 shrink-0">
          <div className="absolute inset-0 rounded-full bg-[#FF2D55]/20 animate-ping" />
          <div className="relative w-3 h-3 rounded-full bg-[#FF2D55] shadow-[0_0_8px_#FF2D55]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold text-[#FF2D55] uppercase tracking-widest">
            Sabrina Agent 运行中
          </div>
          <div className="text-[10px] text-white/45 mt-0.5">
            已执行 {stepCount} 步 · 正在自动操控页面
          </div>
        </div>
      </div>

      {/* Shimmer progress bar */}
      <div className="h-[2px] rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-[#FF2D55] to-transparent"
          style={{ animation: "sabrina-progress-sweep 1.8s ease-in-out infinite" }}
        />
      </div>

      <style>{`
        @keyframes sabrina-progress-sweep {
          0%   { transform: translateX(-150%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}

// ── Plan Overview (Task Tree Visualization) ──────────────────────────────────
function PlanOverview({ plan }: { plan: any[] }) {
  if (!plan || plan.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-white/[0.03] border border-white/5 mx-0.5">
      <div className="text-[9px] font-bold text-white/30 uppercase tracking-[0.1em] mb-1 px-1">
        执行计划 (Task Tree)
      </div>
      <div className="flex flex-col gap-1">
        {plan.map((item, idx) => (
          <div key={item.id || idx} className="flex items-center gap-2.5 px-2 py-1 rounded-md transition-colors">
            <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] border ${
              item.status === 'done' ? 'bg-green-500/20 border-green-500/40 text-green-400' :
              item.status === 'active' ? 'bg-[#FF2D55]/20 border-[#FF2D55]/40 text-[#FF2D55] animate-pulse' :
              'bg-white/5 border-white/10 text-white/20'
            }`}>
              {item.status === 'done' ? '✓' : item.status === 'active' ? '→' : idx + 1}
            </div>
            <span className={`text-[11px] font-medium truncate ${
              item.status === 'done' ? 'text-zinc-500 line-through' :
              item.status === 'active' ? 'text-white' :
              'text-white/40'
            }`}>
              {item.title}
            </span>
            {item.status === 'active' && (
              <div className="ml-auto flex items-center gap-1">
                <div className="w-1 h-1 rounded-full bg-[#FF2D55] animate-ping" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Single Step Card ──────────────────────────────────────────────────────
function StepCard({ entry, isLatest }: { entry: AgentActionEntry; isLatest: boolean }) {
  const isSuccess = entry.type === "action-success" || entry.type === "verify-success";
  const isError = entry.type === "error" || entry.type === "verify-fail" || entry.type === "action-error";
  const isDone = entry.type === "done";

  return (
    <div
      className={[
        "flex flex-col gap-2 p-3 rounded-xl border transition-all duration-300",
        isDone
          ? "bg-green-500/8 border-green-500/25 shadow-[0_0_12px_rgba(16,185,129,0.06)]"
          : isSuccess
          ? "bg-emerald-500/5 border-emerald-500/15"
          : isError
          ? "bg-red-500/8 border-red-500/20"
          : isLatest
          ? "bg-white/[0.04] border-white/10"
          : "bg-white/[0.02] border-white/[0.04]",
      ].join(" ")}
    >
      <div className="flex items-start gap-2.5">
        {/* Screenshot thumbnail or icon */}
        {entry.screenshot ? (
          <div className="relative group shrink-0">
            <img
              src={`data:image/jpeg;base64,${entry.screenshot}`}
              className="w-10 h-10 rounded-lg bg-zinc-800 object-cover border border-white/10 shadow-md group-hover:scale-110 transition-transform duration-300"
              alt="Target element"
            />
            <div className="absolute inset-0 bg-[#FF2D55]/20 opacity-0 group-hover:opacity-100 rounded-lg transition-opacity" />
          </div>
        ) : (
          <div
            className={[
              "w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 border",
              isDone
                ? "bg-green-500/15 border-green-500/30"
                : isSuccess
                ? "bg-emerald-500/10 border-emerald-500/20"
                : isError
                ? "bg-red-500/10 border-red-500/20"
                : "bg-white/5 border-white/8",
            ].join(" ")}
          >
            {renderStatusIcon(entry)}
          </div>
        )}

        <div className="flex-1 flex flex-col gap-1 min-w-0">
          {/* Step label + timestamp */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {entry.step && (
                <span className="text-[9px] font-bold text-white/30 tabular-nums">
                  #{entry.step}
                </span>
              )}
              <span
                className={[
                  "text-[10px] font-bold uppercase tracking-wide",
                  isDone ? "text-green-400" : isError ? "text-red-400" : "text-zinc-400",
                ].join(" ")}
              >
                {STATUS_STEP_LABELS[entry.type] ?? entry.type}
              </span>
              {entry.risk === "red" && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#FF2D55]/20 text-[#FF2D55] font-bold border border-[#FF2D55]/20">
                  ⚠ 高风险
                </span>
              )}
            </div>
            {entry.timestamp && (
              <span className="text-[9px] text-zinc-600 tabular-nums shrink-0">
                {new Date(entry.timestamp).toLocaleTimeString([], {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            )}
          </div>

          {/* Reasoning (Agent's inner thought) */}
          {entry.reasoning && (
            <p className="text-[11px] text-zinc-300 leading-snug italic">
              "{entry.reasoning}"
            </p>
          )}

          {/* Action description */}
          {(entry.action || entry.summary) && (
            <span className="text-[11px] text-zinc-400 leading-snug">
              {entry.summary ?? formatActionDesc(entry.action)}
            </span>
          )}

          {/* AX Label if present */}
          {entry.axLabel && (
            <span className="text-[10px] text-white/30 truncate">
              元素: {entry.axLabel}
            </span>
          )}
        </div>
      </div>

      {/* Error / verify fail detail */}
      {entry.type === "verify-fail" && entry.message && (
        <div className="text-[10px] bg-red-500/10 text-red-400 px-2 py-1.5 rounded-lg flex items-center gap-1.5 border border-red-500/15">
          <span>⚠️</span>
          <span>{entry.message}</span>
        </div>
      )}
      {entry.result?.error && (
        <div className="text-[10px] bg-red-500/10 text-red-400 px-2 py-1.5 rounded-lg leading-tight border border-red-500/15">
          {entry.result.error}
        </div>
      )}
    </div>
  );
}

// ── Currently Thinking Indicator ──────────────────────────────────────────
function ThinkingCard() {
  return (
    <div className="flex items-center gap-3 p-3 bg-indigo-500/6 border border-indigo-500/18 rounded-xl">
      <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center border border-indigo-500/20 shrink-0">
        <span className="text-sm">🧠</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide">
          正在分析决策…
        </span>
        <span className="text-[10px] text-zinc-500 italic">
          理解页面语义，规划下一步操作
        </span>
      </div>
      {/* Three dots */}
      <div className="ml-auto flex items-center gap-1 shrink-0">
        {[0, 150, 300].map((delay) => (
          <div
            key={delay}
            className="w-1 h-1 rounded-full bg-indigo-400/60"
            style={{ animation: `sabrina-dot-pulse 1.2s ease-in-out ${delay}ms infinite` }}
          />
        ))}
      </div>
      <style>{`
        @keyframes sabrina-dot-pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

// ── Main Export ────────────────────────────────────────────────────────────
export const AgentActionStream: React.FC<AgentActionStreamProps> = ({
  journal,
  status,
  warnings = [],
  taskTree = [],
  pendingConfirm,
  onConfirm,
  onStop,
}) => {
  const { preferences: { uiLocale } } = useUiPreferences();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter to only key physical action events
  const filteredJournal = journal.filter(
    (e) =>
      e.type === "action-start" ||
      e.type === "action-success" ||
      e.type === "action-error" ||
      e.type === "verify-success" ||
      e.type === "verify-fail" ||
      e.type === "done" ||
      e.type === "error",
  );

  const isThinkingNow =
    status === "running" && journal[journal.length - 1]?.type === "think";

  // Auto-scroll to latest
  useEffect(() => {
    if (scrollRef.current && status === "running") {
      scrollRef.current.scrollTop = 0;
    }
  }, [journal.length, status]);

  if (journal.length === 0 && status === "idle") return null;

  return (
    <div
      className="flex flex-col gap-2.5 p-3 rounded-2xl border border-zinc-800/70 bg-zinc-900/50 backdrop-blur-md transition-all duration-300"
      style={{ contain: "layout" }}
    >
      {/* ── Live running banner ── */}
      <AgentLiveBanner status={status} stepCount={filteredJournal.length} />

      {/* ── Task Tree Overview (V9) ── */}
      {status === "running" && taskTree.length > 0 && (
        <PlanOverview plan={taskTree} />
      )}

      {/* ── Header (when not running) ── */}
      {status !== "running" && (
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-2">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                status === "completed"
                  ? "bg-green-400"
                  : status === "error" || status === "cancelled"
                  ? "bg-red-400"
                  : "bg-zinc-600"
              }`}
            />
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {translate(uiLocale, "agent.stream.title")}
            </span>
          </div>
        </div>
      )}

      {/* ── Stop button ── */}
      {status === "running" && (
        <div className="flex justify-end">
          <button
            onClick={onStop}
            className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1 rounded-lg transition-colors border border-white/8 hover:border-white/15"
          >
            ⬛ 停止 Agent
          </button>
        </div>
      )}

      {/* ── Thinking indicator ── */}
      {isThinkingNow && <ThinkingCard />}

      {/* ── Journal entries (newest first) ── */}
      {filteredJournal.length > 0 && (
        <div
          ref={scrollRef}
          className="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-0.5 custom-scrollbar"
        >
          {[...filteredJournal].reverse().map((entry, i) => (
            <StepCard key={i} entry={entry} isLatest={i === 0} />
          ))}
        </div>
      )}

      {/* ── Pending confirm guard ── */}
      {pendingConfirm && (
        <div className="mt-1 p-4 bg-[#FF2D55]/10 border border-[#FF2D55]/30 rounded-xl flex flex-col gap-3 shadow-[0_0_20px_rgba(255,45,85,0.1)]">
          <div className="flex items-center gap-2 text-[#FF2D55] font-bold text-[11px] uppercase tracking-widest">
            <span className="text-base">⚠️</span>
            <span>{translate(uiLocale, "agent.stream.confirmRequired")}</span>
          </div>
          <p className="text-zinc-300 text-[11px] leading-relaxed bg-zinc-900/40 px-3 py-2 rounded-lg border border-white/5">
            {pendingConfirm.reason}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onConfirm(true)}
              className="flex-1 py-2 bg-[#FF2D55] hover:bg-[#ff4d6d] text-white rounded-lg text-[11px] font-bold transition-all shadow-lg hover:shadow-[#FF2D55]/25"
            >
              {translate(uiLocale, "agent.stream.confirmExecute")}
            </button>
            <button
              onClick={() => onConfirm(false)}
              className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[11px] font-bold transition-all"
            >
              {translate(uiLocale, "agent.stream.skip")}
            </button>
          </div>
        </div>
      )}

      {/* ── Completed state ── */}
      {status === "completed" && (
        <div className="flex flex-col gap-2">
          <div className="px-4 py-3 bg-green-500/10 border border-green-500/25 rounded-xl text-green-400 text-[11px] font-bold flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(16,185,129,0.08)]">
            <span className="text-base">✨</span>
            {translate(uiLocale, "agent.stream.completed")}
          </div>
          {warnings.length > 0 && (
            <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[10px] text-amber-300 leading-relaxed">
              过程有 {warnings.length} 条波动记录，但任务最终完成。
            </div>
          )}
        </div>
      )}

      {/* ── Error state ── */}
      {(status === "error" || status === "cancelled") && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[11px] font-bold flex items-center justify-center gap-2">
          <span className="text-base">
            {status === "cancelled" ? "⬛" : "⚠️"}
          </span>
          {status === "cancelled" ? "Agent 已停止" : "Agent 遇到错误"}
        </div>
      )}
    </div>
  );
};

// ── Helpers ────────────────────────────────────────────────────────────────
function renderStatusIcon(entry: AgentActionEntry) {
  switch (entry.type) {
    case "observe":       return "👁️";
    case "think":         return "🧠";
    case "action-start":  return "→";
    case "action-success": return "✓";
    case "action-error":  return "✗";
    case "verify-success": return "🛡";
    case "verify-fail":   return "?";
    case "done":          return "✨";
    case "error":         return "⚠";
    default:              return "·";
  }
}

function formatActionDesc(action: any): string {
  if (!action) return "";
  const reason = action.reason || "";
  switch (action.action) {
    case "click":    return reason ? `点击: ${reason}` : "点击元素";
    case "fill":     return reason ? `输入: ${reason}` : "填写字段";
    case "select":   return reason ? `选择: ${reason}` : "选择选项";
    case "scroll":   return `向${action.direction === "down" ? "下" : "上"}滚动`;
    case "navigate": return `跳转至 ${action.url ?? ""}`;
    default:         return action.action;
  }
}
