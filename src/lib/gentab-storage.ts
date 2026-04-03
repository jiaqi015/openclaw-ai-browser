import type { GenTabData, GenTabPreferredType } from "./gentab-types";

export type PendingGenTabMetadata = {
  referenceTabIds: string[];
  userIntent: string;
  preferredType?: GenTabPreferredType;
};

function getPendingKey(genTabId: string) {
  return `sabrina:gentab:pending:${genTabId}`;
}

function getDataKey(genTabId: string) {
  return `sabrina:gentab:data:${genTabId}`;
}

export function getPendingGenTabMetadata(genTabId: string): PendingGenTabMetadata | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(getPendingKey(genTabId));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PendingGenTabMetadata;
  } catch {
    return null;
  }
}

export function setPendingGenTabMetadata(genTabId: string, metadata: PendingGenTabMetadata) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getPendingKey(genTabId), JSON.stringify(metadata));
}

export function clearPendingGenTabMetadata(genTabId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(getPendingKey(genTabId));
}

export function loadGenTabFromStorage(genTabId: string | null): GenTabData | null {
  if (typeof window === "undefined" || !genTabId) {
    return null;
  }

  const raw = window.localStorage.getItem(getDataKey(genTabId));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as GenTabData;
  } catch {
    return null;
  }
}

export function saveGenTabToStorage(genTabId: string, data: GenTabData) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getDataKey(genTabId), JSON.stringify(data));
}

export function clearGenTabFromStorage(genTabId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(getDataKey(genTabId));
}
