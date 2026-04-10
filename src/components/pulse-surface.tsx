/**
 * PulseSurface — Slice 1.
 *
 * The new top-level surface that replaces GenTabSurface for any URL of the
 * form `sabrina://gentab/<id>?pulse=1`. Slice 1 deliberately ships with mock
 * data so we can lock the visual tone before the backend exists.
 *
 * Design intent (vs GenTabSurface):
 *
 *   - No view-type pills. No preferred-type selector. No refine textarea.
 *     The AI decides the layout; the user does not configure renderers.
 *   - The page opens directly into *content*. The first thing on screen is
 *     the agent's current intent and the blocks themselves — not a control
 *     panel.
 *   - The status bar shows a heartbeat: the agent is alive, doing something,
 *     and the user can see what step it is on. The plan strip is collapsed
 *     by default to keep the surface quiet.
 */

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Pause, Sparkles, X } from "lucide-react";
import { cn } from "../lib/utils";
import type {
  PulseBlock,
  PulseData,
  PulseStep,
  PulseStepStatus,
} from "../lib/pulse-types";
import { PulseBlockView, type PulseBlockContext } from "./pulse-blocks";

interface PulseSurfaceProps {
  pulse: PulseData;
  onClose?: () => void;
}

// --------------------------------------------------------------------------
// Heartbeat dot — animates while the agent is "thinking".
// --------------------------------------------------------------------------

function HeartbeatDot({ status }: { status: PulseData["status"] }) {
  const tone =
    status === "thinking"
      ? "bg-apple-pink"
      : status === "live"
        ? "bg-emerald-300/85"
        : status === "paused"
          ? "bg-amber-300/75"
          : status === "error"
            ? "bg-rose-300/85"
            : "bg-white/35";
  const pulse = status === "thinking" || status === "live";
  return (
    <span className="relative inline-flex h-2 w-2 items-center justify-center">
      {pulse ? (
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-60",
            tone,
            "animate-ping",
          )}
        />
      ) : null}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", tone)} />
    </span>
  );
}

// --------------------------------------------------------------------------
// Status bar — top of pulse, always visible.
// --------------------------------------------------------------------------

function PulseStatusBar({
  pulse,
  onClose,
  onTogglePlan,
  planExpanded,
}: {
  pulse: PulseData;
  onClose?: () => void;
  onTogglePlan: () => void;
  planExpanded: boolean;
}) {
  const currentStep = pulse.plan.find((step) => step.id === pulse.currentStepId);
  const doneCount = pulse.plan.filter((s) => s.status === "done").length;
  const totalCount = pulse.plan.length;
  const progress = totalCount === 0 ? 0 : (doneCount / totalCount) * 100;

  const statusLabel: Record<PulseData["status"], string> = {
    thinking: "正在思考",
    live: "持续监听",
    paused: "已暂停",
    done: "已完成",
    error: "出错了",
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-1.5">
            <HeartbeatDot status={pulse.status} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                Pulse · {statusLabel[pulse.status]}
              </span>
              {pulse.provenance.trigger === "ambient" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] text-white/45">
                  <Sparkles className="h-2.5 w-2.5" />
                  从你的浏览中长出
                </span>
              ) : null}
            </div>
            <h1 className="mt-1 truncate text-[26px] font-medium leading-tight tracking-tight text-white/95">
              {pulse.title}
            </h1>
            <div className="mt-1 truncate text-[13px] text-white/45">{pulse.intent}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white/85"
            title="暂停 Pulse"
          >
            <Pause className="h-3.5 w-3.5" />
          </button>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white/85"
              title="关闭"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Now-line: agent's current step + thin progress rail */}
      <button
        type="button"
        onClick={onTogglePlan}
        className="group flex items-center gap-3 rounded-[14px] border border-white/8 bg-white/[0.025] px-4 py-3 text-left transition-colors hover:bg-white/[0.045]"
      >
        {planExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/40 transition-transform" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/40 transition-transform" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-white/30">
            <span>当前步骤</span>
            <span className="text-white/20">·</span>
            <span>{doneCount}/{totalCount}</span>
          </div>
          <div className="mt-0.5 truncate text-[13.5px] text-white/82">
            {currentStep?.summary ?? "等待下一步"}
          </div>
        </div>
        <div className="hidden h-1 w-32 shrink-0 overflow-hidden rounded-full bg-white/8 sm:block">
          <div
            className="h-full rounded-full bg-white/55 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </button>
    </div>
  );
}

// --------------------------------------------------------------------------
// Plan strip — collapsed by default. Reveals every step.
// --------------------------------------------------------------------------

function PlanStripStepRow({ step }: { step: PulseStep }) {
  const tone: Record<PulseStepStatus, { dot: string; text: string }> = {
    pending: { dot: "bg-white/15", text: "text-white/35" },
    running: { dot: "bg-apple-pink", text: "text-white/85" },
    done: { dot: "bg-emerald-300/80", text: "text-white/55" },
    skipped: { dot: "bg-white/20", text: "text-white/30" },
    failed: { dot: "bg-rose-300/85", text: "text-rose-200/80" },
  };
  const t = tone[step.status];
  return (
    <li className="flex items-center gap-3 py-1.5">
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", t.dot)} />
      <span className={cn("flex-1 truncate text-[12.5px] leading-5", t.text)}>{step.summary}</span>
      {step.note ? (
        <span className="text-[10.5px] text-white/35">{step.note}</span>
      ) : null}
    </li>
  );
}

function PlanStrip({ pulse }: { pulse: PulseData }) {
  return (
    <div className="rounded-[14px] border border-white/8 bg-white/[0.02] px-4 py-3">
      <div className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-white/30">
        Plan · 共 {pulse.plan.length} 步
      </div>
      <ul className="flex flex-col">
        {pulse.plan.map((step) => (
          <PlanStripStepRow key={step.id} step={step} />
        ))}
      </ul>
    </div>
  );
}

// --------------------------------------------------------------------------
// Block layout — walks the layout descriptor + the block dictionary.
// --------------------------------------------------------------------------

function BlockColumns({
  pulse,
  ctx,
}: {
  pulse: PulseData;
  ctx: PulseBlockContext;
}) {
  const blocks = useMemo<PulseBlock[]>(() => {
    return pulse.layout.blockIds
      .map((id) => pulse.blocks[id])
      .filter((b): b is PulseBlock => !!b);
  }, [pulse.layout, pulse.blocks]);

  if (blocks.length === 0) {
    return (
      <div className="py-12 text-center text-[12px] text-white/35">
        Pulse 还在准备第一批内容…
      </div>
    );
  }

  // two-col: split roughly in half. single/stack: one column.
  if (pulse.layout.kind === "two-col") {
    const mid = Math.ceil(blocks.length / 2);
    const left = blocks.slice(0, mid);
    const right = blocks.slice(mid);
    return (
      <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
        <div className="flex flex-col gap-8">
          {left.map((b) => (
            <PulseBlockView key={b.id} block={b} ctx={ctx} />
          ))}
        </div>
        <div className="flex flex-col gap-8">
          {right.map((b) => (
            <PulseBlockView key={b.id} block={b} ctx={ctx} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {blocks.map((b) => (
        <PulseBlockView key={b.id} block={b} ctx={ctx} />
      ))}
    </div>
  );
}

// --------------------------------------------------------------------------
// Surface
// --------------------------------------------------------------------------

export function PulseSurface({ pulse, onClose }: PulseSurfaceProps) {
  const [planExpanded, setPlanExpanded] = useState(false);

  const ctx: PulseBlockContext = {
    onOpenSource: (source) => {
      window.sabrinaDesktop?.browser.openUrlInNewTab(source.url);
    },
    onDispatchAction: () => {
      // Slice 1: render-only. Slice 2 will route to the host action layer.
    },
  };

  return (
    <div className="surface-screen absolute inset-0 overflow-y-auto">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-8 py-10">
        <PulseStatusBar
          pulse={pulse}
          onClose={onClose}
          onTogglePlan={() => setPlanExpanded((v) => !v)}
          planExpanded={planExpanded}
        />

        {planExpanded ? <PlanStrip pulse={pulse} /> : null}

        <BlockColumns pulse={pulse} ctx={ctx} />

        <div className="border-t border-white/5 pt-3 text-[10.5px] text-white/30">
          {pulse.provenance.sourceTabIds.length} 个来源标签页 · 上次心跳{" "}
          {new Date(pulse.lastPulseAt).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
