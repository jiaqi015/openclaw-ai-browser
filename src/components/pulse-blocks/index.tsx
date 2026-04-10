/**
 * Pulse block primitives — Slice 1.
 *
 * The renderer is intentionally a flat registry: `BLOCK_RENDERERS[block.type]`.
 * The AI freely composes blocks from these primitives — there is *no* table /
 * timeline / card-grid renderer above this layer. Layout is just "where in the
 * column does this block sit", which is decided by `PulseLayout` in the data,
 * not by a global view-type toggle.
 *
 * Visual tone: Apple glass, very quiet. Blocks are not cards in the heavy
 * sense — they are gentle pieces of typography on the dark surface, separated
 * by air. Saturated color is reserved for *meaning* (delta tone, action), not
 * decoration.
 */

import type { JSX } from "react";
import { ArrowUpRight, Check } from "lucide-react";
import { cn } from "../../lib/utils";
import type {
  ChecklistBlock,
  NoteBlock,
  PulseAction,
  PulseBlock,
  PulseSourceRef,
  QuoteBlock,
  StatBlock,
} from "../../lib/pulse-types";

export interface PulseBlockContext {
  /** Open a source URL — slice 1 just calls window.sabrinaDesktop. */
  onOpenSource?: (source: PulseSourceRef) => void;
  /** Slice 1: render-only. Slice 2 will route to host action layer. */
  onDispatchAction?: (action: PulseAction) => void;
}

// --------------------------------------------------------------------------
// Source link — shared by stat / quote
// --------------------------------------------------------------------------

function SourceLink({
  source,
  onOpen,
}: {
  source?: PulseSourceRef;
  onOpen?: (source: PulseSourceRef) => void;
}) {
  if (!source) return null;
  let host = "";
  try {
    host = new URL(source.url).host;
  } catch {
    host = source.url;
  }
  return (
    <button
      type="button"
      onClick={() => onOpen?.(source)}
      title={source.title || source.url}
      className="inline-flex items-center gap-1 text-[10.5px] text-white/35 transition-colors hover:text-white/70"
    >
      <span className="truncate max-w-[180px]">{host}</span>
      <ArrowUpRight className="h-2.5 w-2.5" />
    </button>
  );
}

// --------------------------------------------------------------------------
// stat
// --------------------------------------------------------------------------

function StatBlockView({
  block,
  ctx,
}: {
  block: StatBlock;
  ctx: PulseBlockContext;
}) {
  const deltaTone =
    block.deltaTone === "good"
      ? "text-emerald-300/85"
      : block.deltaTone === "bad"
        ? "text-rose-300/85"
        : "text-white/45";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[10.5px] uppercase tracking-[0.16em] text-white/35">
        {block.label}
      </div>
      <div className="flex items-baseline gap-2.5">
        <div className="text-[34px] font-medium leading-none tracking-tight text-white/92">
          {block.value}
        </div>
        {block.delta ? (
          <div className={cn("text-[11px] font-medium", deltaTone)}>{block.delta}</div>
        ) : null}
      </div>
      <SourceLink source={block.source} onOpen={ctx.onOpenSource} />
    </div>
  );
}

// --------------------------------------------------------------------------
// quote
// --------------------------------------------------------------------------

function QuoteBlockView({
  block,
  ctx,
}: {
  block: QuoteBlock;
  ctx: PulseBlockContext;
}) {
  return (
    <figure className="flex flex-col gap-2 border-l border-white/12 pl-4">
      <blockquote className="text-[14px] leading-[1.7] text-white/78">
        “{block.text}”
      </blockquote>
      <figcaption className="flex items-center gap-2 text-[10.5px] text-white/40">
        {block.attribution ? <span>{block.attribution}</span> : null}
        <SourceLink source={block.source} onOpen={ctx.onOpenSource} />
      </figcaption>
    </figure>
  );
}

// --------------------------------------------------------------------------
// checklist
// --------------------------------------------------------------------------

function ChecklistBlockView({
  block,
  ctx,
}: {
  block: ChecklistBlock;
  ctx: PulseBlockContext;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {block.title ? (
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-white/35">
          {block.title}
        </div>
      ) : null}
      <ul className="flex flex-col gap-1.5">
        {block.items.map((item) => {
          const hasAction = !!item.action;
          return (
            <li
              key={item.id}
              className="group flex items-start gap-2.5 text-[13px] leading-6 text-white/75"
            >
              <span
                className={cn(
                  "mt-[5px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                  item.checked
                    ? "border-white/45 bg-white/20"
                    : "border-white/20 group-hover:border-white/35",
                )}
                aria-hidden="true"
              >
                {item.checked ? <Check className="h-2.5 w-2.5 text-white/90" /> : null}
              </span>
              <span className={cn("flex-1", item.checked && "text-white/40 line-through")}>
                {item.text}
              </span>
              {hasAction ? (
                <button
                  type="button"
                  onClick={() => item.action && ctx.onDispatchAction?.(item.action)}
                  className="opacity-0 transition-opacity group-hover:opacity-100 text-[10.5px] text-white/50 hover:text-white/90"
                >
                  {item.action?.label ?? "执行"}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// --------------------------------------------------------------------------
// note
// --------------------------------------------------------------------------

function NoteBlockView({ block }: { block: NoteBlock; ctx: PulseBlockContext }) {
  const toneRing =
    block.tone === "insight"
      ? "border-l-2 border-l-apple-pink/55"
      : block.tone === "warning"
        ? "border-l-2 border-l-amber-300/60"
        : "";
  return (
    <div className={cn("flex flex-col gap-1.5", toneRing && `${toneRing} pl-4`)}>
      {block.heading ? (
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-white/35">
          {block.heading}
        </div>
      ) : null}
      <div className="whitespace-pre-line text-[13.5px] leading-[1.75] text-white/72">
        {block.text}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Registry
// --------------------------------------------------------------------------

export function PulseBlockView({
  block,
  ctx,
}: {
  block: PulseBlock;
  ctx: PulseBlockContext;
}): JSX.Element {
  switch (block.type) {
    case "stat":
      return <StatBlockView block={block} ctx={ctx} />;
    case "quote":
      return <QuoteBlockView block={block} ctx={ctx} />;
    case "checklist":
      return <ChecklistBlockView block={block} ctx={ctx} />;
    case "note":
      return <NoteBlockView block={block} ctx={ctx} />;
    default: {
      // Exhaustiveness guard — if a new primitive is added to the union and
      // forgotten here, TS will complain at compile time.
      const _exhaustive: never = block;
      return <div className="text-xs text-rose-300/70">unknown block: {(_exhaustive as { type: string }).type}</div>;
    }
  }
}
