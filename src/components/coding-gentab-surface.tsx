/**
 * CodingGenTabSurface
 *
 * Two modes:
 *
 *  1. Loading theatre (status = "generating")
 *     ─ Left: the agent's staged "thinking" stream — four phases that advance
 *       on a timer while the real IPC call runs. Each phase has a label +
 *       sublabel that reads like a developer working through a problem.
 *     ─ Right: an animated "canvas" placeholder that suggests something
 *       creative is being assembled. Intentionally abstract — no fake code
 *       editor, no skeleton screens.
 *
 *  2. Result shell (status = "done")
 *     ─ Fullscreen iframe with the AI-written HTML (via srcDoc).
 *     ─ Thin floating toolbar at the very top: title + design-choice note +
 *       close. Goes semi-transparent on hover so it stays out of the way.
 *     ─ No config, no view-type toggle, no refine textarea. The page IS the
 *       product.
 *
 *  3. Error state (status = "error")
 *     ─ Minimal. Show what went wrong, offer retry.
 */

import { useRef, useState } from "react";
import { Sparkles, X, RefreshCw, Wand2, Pencil, Copy, Check, ArrowRight } from "lucide-react";
import { cn } from "../lib/utils";
import { useCodingGenTabState, type StageInfo } from "../application/use-coding-gentab-state";

// --------------------------------------------------------------------------
// Loading theatre
// --------------------------------------------------------------------------

const STAGE_ICONS: Record<string, string> = {
  reading: "📖",
  thinking: "💡",
  coding: "⌨️",
  checking: "🔍",
};

function ThoughtLine({
  info,
  isActive,
  isDone,
}: {
  info: StageInfo;
  isActive: boolean;
  isDone: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 py-2 transition-all duration-500",
        isActive ? "opacity-100" : isDone ? "opacity-45" : "opacity-20",
      )}
    >
      <span
        className={cn(
          "mt-0.5 text-base leading-none transition-transform duration-300",
          isActive && "scale-110",
        )}
      >
        {STAGE_ICONS[info.stage] ?? "·"}
      </span>
      <div>
        <div
          className={cn(
            "text-[13.5px] font-medium leading-snug transition-colors",
            isActive ? "text-white/92" : isDone ? "text-white/50" : "text-white/25",
          )}
        >
          {info.label}
        </div>
        {(isActive || isDone) && info.sublabel ? (
          <div className="mt-0.5 text-[11.5px] leading-snug text-white/38">{info.sublabel}</div>
        ) : null}
      </div>
      {isDone ? (
        <span className="ml-auto mt-0.5 text-[10px] text-white/28">✓</span>
      ) : isActive ? (
        <span className="ml-auto mt-1.5 flex h-1.5 w-1.5 shrink-0 rounded-full bg-apple-pink">
          <span className="animate-ping absolute h-1.5 w-1.5 rounded-full bg-apple-pink opacity-75" />
        </span>
      ) : null}
    </div>
  );
}

// The four stages shown in the thought stream
const ALL_STAGES: StageInfo[] = [
  { stage: "reading", label: "正在读你打开的网页", sublabel: "提取标题、正文和关键数据…", progressPct: 12 },
  { stage: "thinking", label: "在想最合适的表现形式", sublabel: "这件事应该长什么样？不是表格，是一个网页…", progressPct: 32 },
  { stage: "coding", label: "开始写代码", sublabel: "构建交互、填入真实数据、加上动画…", progressPct: 65 },
  { stage: "checking", label: "差不多了，自检一遍", sublabel: "确保数据对得上、交互能点通…", progressPct: 88 },
];

function LoadingTheatre({
  stageInfo,
  progressPct,
}: {
  stageInfo: StageInfo;
  progressPct: number;
}) {
  const activeIdx = ALL_STAGES.findIndex((s) => s.stage === stageInfo.stage);

  return (
    <div className="surface-screen absolute inset-0 flex items-center justify-center">
      <div className="flex w-full max-w-2xl flex-col gap-10 px-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-apple-pink/15">
            <Wand2 className="h-4.5 w-4.5 text-apple-pink" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/32">GenTab</div>
            <div className="text-[15px] font-medium text-white/88">正在为你创作一张交互网页</div>
          </div>
        </div>

        {/* Thought stream */}
        <div className="flex flex-col divide-y divide-white/[0.04]">
          {ALL_STAGES.map((s, i) => (
            <ThoughtLine
              key={s.stage}
              info={s}
              isActive={i === activeIdx}
              isDone={i < activeIdx}
            />
          ))}
        </div>

        {/* Progress rail */}
        <div className="space-y-2">
          <div className="h-px w-full overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-apple-pink/70 transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="text-right text-[10px] tabular-nums text-white/28">
            {progressPct}%
          </div>
        </div>

        {/* Subtle note */}
        <p className="text-center text-[11px] text-white/22">
          AI 在为你的任务原创设计一张网页，通常需要 30–90 秒
        </p>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Floating toolbar (shown over the iframe when done)
// --------------------------------------------------------------------------

function FloatingToolbar({
  title,
  designChoice,
  html,
  onClose,
  onRefine,
}: {
  title: string;
  designChoice: string;
  html: string;
  onClose: () => void;
  onRefine: (text: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);
  const [refineText, setRefineText] = useState("");
  const [copied, setCopied] = useState(false);
  const refineInputRef = useRef<HTMLInputElement>(null);

  function handleCopyHtml() {
    navigator.clipboard.writeText(html).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleOpenRefine() {
    setRefineOpen(true);
    setTimeout(() => refineInputRef.current?.focus(), 50);
  }

  function handleSubmitRefine() {
    if (!refineText.trim()) return;
    onRefine(refineText.trim());
    setRefineText("");
    setRefineOpen(false);
  }

  return (
    <div
      className={cn(
        "absolute inset-x-0 top-0 z-20 flex flex-col transition-all duration-300",
        "bg-gradient-to-b from-black/75 via-black/45 to-transparent",
        hovered || refineOpen ? "opacity-100" : "opacity-55 hover:opacity-100",
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { if (!refineOpen) setHovered(false); }}
    >
      {/* Main row */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Sparkles className="h-3 w-3 shrink-0 text-apple-pink/80" />
          <span className="truncate text-[12.5px] font-medium text-white/85">{title}</span>
          {designChoice && !refineOpen ? (
            <span className="hidden truncate text-[11px] text-white/36 md:block">
              · {designChoice}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {/* Copy HTML */}
          <button
            type="button"
            onClick={handleCopyHtml}
            className="flex h-6 w-6 items-center justify-center rounded text-white/45 transition-colors hover:bg-white/10 hover:text-white/80"
            title="复制 HTML"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          {/* Refine */}
          <button
            type="button"
            onClick={handleOpenRefine}
            className={cn(
              "flex h-6 items-center gap-1 rounded px-1.5 text-[11px] transition-colors",
              refineOpen
                ? "bg-apple-pink/20 text-apple-pink/90"
                : "text-white/45 hover:bg-white/10 hover:text-white/80",
            )}
            title="优化这张网页"
          >
            <Pencil className="h-3 w-3" />
            <span>优化</span>
          </button>
          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-white/45 transition-colors hover:bg-white/10 hover:text-white/80"
            title="关闭"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Refine input panel */}
      {refineOpen ? (
        <div className="flex items-center gap-2 border-t border-white/8 px-4 py-2">
          <input
            ref={refineInputRef}
            type="text"
            value={refineText}
            onChange={(e) => setRefineText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmitRefine();
              if (e.key === "Escape") { setRefineOpen(false); setRefineText(""); }
            }}
            placeholder="告诉 AI 你想改什么，如：改成英文、把背景色改成白色…"
            className="flex-1 bg-transparent text-[12px] text-white/85 placeholder:text-white/30 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSubmitRefine}
            disabled={!refineText.trim()}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-apple-pink/20 text-apple-pink/90 transition-colors hover:bg-apple-pink/35 disabled:opacity-40"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => { setRefineOpen(false); setRefineText(""); }}
            className="text-[11px] text-white/35 hover:text-white/65"
          >
            取消
          </button>
        </div>
      ) : null}
    </div>
  );
}

// --------------------------------------------------------------------------
// Error state
// --------------------------------------------------------------------------

function ErrorView({
  message,
  onClose,
  onRetry,
}: {
  message: string;
  onClose: () => void;
  onRetry?: () => void;
}) {
  return (
    <div className="surface-screen absolute inset-0 flex items-center justify-center">
      <div className="flex max-w-md flex-col items-center gap-6 px-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
          <Wand2 className="h-7 w-7 text-white/35" />
        </div>
        <div>
          <div className="text-[15px] font-medium text-white/80">这次没做出来</div>
          <div className="mt-2 text-[12.5px] leading-6 text-white/42">{message}</div>
        </div>
        <div className="flex items-center gap-3">
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.05] px-4 py-2 text-[12.5px] font-medium text-white/75 transition-colors hover:bg-white/[0.09]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              重试
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-[12.5px] text-white/45 transition-colors hover:text-white/75"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Main surface
// --------------------------------------------------------------------------

export function CodingGenTabSurface({
  url,
  onCloseGenTab,
}: {
  url: string;
  onCloseGenTab?: (genId: string) => void;
}) {
  // Extract genId from sabrina://gentab/<id>?v=coding
  const genId = url.replace(/^sabrina:\/\/gentab\//, "").split("?")[0];

  const { status, stageInfo, progressPct, gentab, error, handleClose, handleRetry, handleRefine } = useCodingGenTabState({
    genId,
    url,
    onClose: onCloseGenTab,
  });

  if (status === "error") {
    return (
      <ErrorView
        message={error ?? "未知错误"}
        onClose={handleClose}
        onRetry={handleRetry}
      />
    );
  }

  if (status === "generating" || status === "idle") {
    return <LoadingTheatre stageInfo={stageInfo} progressPct={progressPct} />;
  }

  // Done: render the AI page in a fullscreen iframe
  if (!gentab) return null;

  return (
    <div className="absolute inset-0">
      {/* Floating toolbar */}
      <FloatingToolbar
        title={gentab.title}
        designChoice={gentab.designChoice}
        html={gentab.html}
        onClose={handleClose}
        onRefine={(text) => handleRefine(text, gentab.html)}
      />

      {/* The AI-written page */}
      <iframe
        srcDoc={gentab.html}
        className="absolute inset-0 h-full w-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        title={gentab.title}
      />
    </div>
  );
}
