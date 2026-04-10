/**
 * Pulse — Sabrina's answer to Disco's GenTab.
 *
 * A Pulse is *not* a generated artifact. It is a long-running agent workbench
 * that grew out of the user's browsing posture. Three things separate it from
 * GenTab/Disco:
 *
 *   1. It has a heartbeat. The agent keeps running in the background, blocks
 *      stream in over time, and the user can see / edit / branch / pause the
 *      plan at any moment.
 *   2. It has no fixed renderer. The AI freely composes blocks from a small
 *      primitive vocabulary (stat / quote / checklist / note / ... grows over
 *      time). There is no "table vs timeline vs card-grid" toggle.
 *   3. Its blocks can act on the browser, not just describe it. An
 *      action-button block dispatches a real tool call back to the host.
 *
 * This file is the *frontend* contract. The backend will produce JSON shaped
 * exactly like this and the renderer will walk it. Slice 1 only consumes mock
 * data — backend wiring lands in slice 2.
 */

// ---------- Plan ----------

export type PulseStepStatus =
  | "pending"
  | "running"
  | "done"
  | "skipped"
  | "failed";

export interface PulseStep {
  id: string;
  /** One-line human description, present tense ("核实 3 家 GPU 的库存"). */
  summary: string;
  status: PulseStepStatus;
  /** Block ids this step produced — used to "trace" a block back to its step. */
  producedBlockIds?: string[];
  /** Optional short reason if skipped/failed. */
  note?: string;
}

// ---------- Layout ----------

export type PulseLayoutKind = "single" | "two-col" | "stack";

export interface PulseLayout {
  kind: PulseLayoutKind;
  /** Block ids in render order. For two-col we split roughly in half. */
  blockIds: string[];
}

// ---------- Blocks ----------

export type PulseBlock =
  | StatBlock
  | QuoteBlock
  | ChecklistBlock
  | NoteBlock;

interface PulseBlockBase {
  id: string;
  /** Optional back-reference to the plan step that produced this block. */
  fromStepId?: string;
}

export interface StatBlock extends PulseBlockBase {
  type: "stat";
  label: string;
  value: string;
  /** Optional delta vs previous value, free-form ("↓ ¥1000 vs 昨日"). */
  delta?: string;
  deltaTone?: "good" | "bad" | "neutral";
  /** Source attribution — clicking jumps back to the source tab. */
  source?: PulseSourceRef;
}

export interface QuoteBlock extends PulseBlockBase {
  type: "quote";
  /** Original text span lifted from the source page. */
  text: string;
  /** Editorial framing the AI gives the quote ("店家原话："). */
  attribution?: string;
  source?: PulseSourceRef;
}

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  /** When present, ticking this item should dispatch the action. Slice 1 just shows the affordance. */
  action?: PulseAction;
}

export interface ChecklistBlock extends PulseBlockBase {
  type: "checklist";
  title?: string;
  items: ChecklistItem[];
}

export interface NoteBlock extends PulseBlockBase {
  type: "note";
  /** Plain text — keep it short. Multi-paragraph allowed via \n\n. */
  text: string;
  /** Optional small heading rendered above the text. */
  heading?: string;
  tone?: "neutral" | "insight" | "warning";
}

// ---------- Source / action ----------

export interface PulseSourceRef {
  /** Tab id captured at generation time, lets us tell live / drifted / closed. */
  tabId?: string;
  url: string;
  /** Visible title for tooltips. */
  title?: string;
}

/**
 * Action declared by a block. Slice 1 only renders these — slice 2 will route
 * them to the host action layer (open_tab / scan_tab / click_in_tab / ...).
 */
export interface PulseAction {
  tool: string;
  args?: Record<string, unknown>;
  /** Short human label shown on the affordance. */
  label?: string;
  /** When true, a confirm dialog must run before dispatch. */
  requiresConfirm?: boolean;
}

// ---------- Top-level ----------

export type PulseStatus = "thinking" | "live" | "paused" | "done" | "error";

export interface PulseProvenance {
  /** Tabs the pulse was distilled from. */
  sourceTabIds: string[];
  /** If branched off another pulse. */
  derivedFromPulseId?: string;
  /** How the pulse was born — drives the badge in the status bar. */
  trigger: "ambient" | "manual";
}

export interface PulseData {
  schemaVersion: "pulse.1";
  id: string;
  title: string;
  /** One-line user-facing intent inferred by the agent ("帮你挑一张 RTX 4090"). */
  intent: string;
  status: PulseStatus;

  plan: PulseStep[];
  /** Which step is "now". null when status is paused/done/error. */
  currentStepId: string | null;

  layout: PulseLayout;
  blocks: Record<string, PulseBlock>;

  provenance: PulseProvenance;

  createdAt: string;
  /** Wall-clock of the most recent agent activity — drives the heartbeat dot. */
  lastPulseAt: string;
}
