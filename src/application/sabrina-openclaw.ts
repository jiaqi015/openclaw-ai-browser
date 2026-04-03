export type SabrinaBindingTarget = "local" | "remote";

export type SabrinaBindingSetupStepStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "error";

export type SabrinaBindingSetupStatus =
  | "idle"
  | "bootstrapping"
  | "pairing"
  | "ready"
  | "degraded";

export interface SabrinaBindingSetupStep {
  id: string;
  title: string;
  description: string;
  status: SabrinaBindingSetupStepStatus;
}

export interface SabrinaBindingSetupState {
  status: SabrinaBindingSetupStatus;
  target: SabrinaBindingTarget | null;
  title: string;
  description: string;
  note?: string;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
  steps: SabrinaBindingSetupStep[];
}

export interface SabrinaThreadSummary {
  threadId: string;
  title: string;
  siteLabel: string;
  siteHost: string;
  preview: string;
  updatedAt: string;
  updatedAtLabel: string;
  active?: boolean;
  status?: "active" | "archived" | "error";
}

export interface SabrinaTabReferenceCandidate {
  id: string;
  title: string;
  host: string;
  url: string;
  favicon?: string | null;
  active?: boolean;
}

export {
  formatThreadTimestampLabel,
  getThreadSiteLabel,
  getUrlHostLabel,
  normalizePageKey,
  shouldReuseThreadOnNavigation,
} from "../../runtime/threads/ThreadMetadata.mjs";
