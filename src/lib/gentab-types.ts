import { translate, type UiLocale } from "../../shared/localization.mjs";

export type GenTabType = "table" | "list" | "timeline" | "comparison" | "card-grid";
export type GenTabPreferredType = GenTabType | "auto";

export const genTabTypeLabels: Record<GenTabPreferredType, string> = {
  auto: "自动",
  table: "表格",
  list: "清单",
  timeline: "时间线",
  comparison: "对比台",
  "card-grid": "卡片墙",
};

export function getGenTabTypeLabel(locale: UiLocale, type: GenTabPreferredType): string {
  return translate(locale, `gentab.type.${type}`);
}

export function normalizeGenTabPreferredType(value: unknown): GenTabPreferredType {
  if (
    value === "table" ||
    value === "list" ||
    value === "timeline" ||
    value === "comparison" ||
    value === "card-grid"
  ) {
    return value;
  }

  return "auto";
}

export interface GenTabItem {
  id: string;
  title: string;
  description?: string;
  sourceUrl: string;
  sourceTitle: string;
  fields?: Record<string, string>;
  date?: string;
  /** Exact text span the AI extracted this item from. Used for hover preview and liveness diffing. */
  quote?: string;
  /** Tab id from the Browser Context Package provenance at generation time. Enables liveness tracking against currently open tabs. */
  sourceTabId?: string;
}

export type GenTabCellLiveness = "live" | "drifted" | "closed" | "unknown";

export interface GenTabSection {
  id: string;
  title: string;
  description?: string;
  bullets: string[];
}

export interface GenTabSource {
  url: string;
  title: string;
  host?: string;
  whyIncluded?: string;
}

export interface GenTabData {
  schemaVersion: "1" | "2";
  type: GenTabType;
  title: string;
  description?: string;
  summary?: string;
  insights?: string[];
  sections?: GenTabSection[];
  suggestedPrompts?: string[];
  sources?: GenTabSource[];
  items: GenTabItem[];
  metadata: {
    sourceTabIds: string[];
    requestedReferenceTabIds?: string[];
    missingReferenceTabIds?: string[];
    selectionState?: "page" | "selection";
    totalApproxChars?: number;
    userIntent: string;
    generatedAt: string;
    preferredType?: GenTabPreferredType;
    /** Set by the backend whenever any single cell is refreshed via Live Cells. */
    lastCellRefreshAt?: string;
  };
}

export type GenTabStatus = "idle" | "generating" | "done" | "error";

export interface GenTabGenerationState {
  status: GenTabStatus;
  gentab: GenTabData | null;
  error: string | null;
  progress: number;
}

export function createEmptyGenTabState(): GenTabGenerationState {
  return {
    status: "idle",
    gentab: null,
    error: null,
    progress: 0,
  };
}

export function validateGenTabData(data: unknown): data is GenTabData {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (d.schemaVersion !== "1" && d.schemaVersion !== "2") return false;
  if (typeof d.type !== "string") return false;
  if (typeof d.title !== "string") return false;
  if (!Array.isArray(d.items)) return false;
  if (!d.metadata || typeof d.metadata !== "object") return false;
  return true;
}
