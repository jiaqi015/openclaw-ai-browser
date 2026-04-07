import fs from "node:fs/promises";
import path from "node:path";

const allowedPreferredTypes = new Set([
  "auto",
  "table",
  "list",
  "timeline",
  "comparison",
  "card-grid",
]);

let resolveStatePath = () => path.join(process.cwd(), "gentab-state.json");
let recordGenTabEvent = () => {};
let persistQueue = Promise.resolve();
let persistNonce = 0;
let state = {
  pendingById: {},
  genTabsById: {},
};

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function cloneJsonValue(value) {
  if (value == null) {
    return null;
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function normalizePreferredType(value) {
  return allowedPreferredTypes.has(value) ? value : "auto";
}

function normalizePendingMetadata(rawMetadata) {
  if (!rawMetadata || typeof rawMetadata !== "object") {
    return null;
  }

  const referenceTabIds = Array.isArray(rawMetadata.referenceTabIds)
    ? Array.from(
        new Set(
          rawMetadata.referenceTabIds
            .map((tabId) => `${tabId ?? ""}`.trim())
            .filter(Boolean),
        ),
      )
    : [];
  const userIntent = `${rawMetadata.userIntent ?? ""}`.trim();

  if (referenceTabIds.length === 0 || !userIntent) {
    return null;
  }

  return {
    referenceTabIds,
    userIntent,
    preferredType: normalizePreferredType(rawMetadata.preferredType),
  };
}

function isValidGenTabData(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  return (
    (value.schemaVersion === "1" || value.schemaVersion === "2") &&
    typeof value.type === "string" &&
    typeof value.title === "string" &&
    Array.isArray(value.items) &&
    value.metadata &&
    typeof value.metadata === "object"
  );
}

function normalizeGenTabData(rawData) {
  if (!isValidGenTabData(rawData)) {
    return null;
  }

  const cloned = cloneJsonValue(rawData);
  if (!cloned) {
    return null;
  }

  if (!cloned.metadata || typeof cloned.metadata !== "object") {
    return null;
  }

  cloned.metadata.preferredType = normalizePreferredType(cloned.metadata.preferredType);
  return cloned;
}

async function readJsonFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeStoreState(rawState) {
  const pendingById = {};
  for (const [rawGenId, rawMetadata] of Object.entries(rawState?.pendingById ?? {})) {
    const genId = `${rawGenId ?? ""}`.trim();
    const metadata = normalizePendingMetadata(rawMetadata);
    if (!genId || !metadata) {
      continue;
    }

    pendingById[genId] = metadata;
  }

  const genTabsById = {};
  for (const [rawGenId, rawData] of Object.entries(rawState?.genTabsById ?? {})) {
    const genId = `${rawGenId ?? ""}`.trim();
    const data = normalizeGenTabData(rawData);
    if (!genId || !data) {
      continue;
    }

    genTabsById[genId] = data;
  }

  return { pendingById, genTabsById };
}

async function persistGenTabStoreState() {
  const filePath = resolveStatePath();
  const payload = JSON.stringify(state, null, 2);
  const queuedPersist = persistQueue.catch(() => {}).then(async () => {
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}-${persistNonce++}.tmp`;

    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(tmpPath, payload, "utf8");
      await fs.rename(tmpPath, filePath);
    } catch (error) {
      await fs.rm(tmpPath, { force: true }).catch(() => {});
      recordGenTabEvent("error", "gentab", "持久化 GenTab 状态失败", {
        source: "main",
        kind: "gentab-store-persist-failure",
        details: { message: error instanceof Error ? error.message : String(error) },
      });
      throw error;
    }
  });

  persistQueue = queuedPersist;
  return queuedPersist;
}

export function initGenTabStore(host = {}) {
  resolveStatePath =
    typeof host?.resolveStatePath === "function"
      ? host.resolveStatePath
      : () => path.join(process.cwd(), "gentab-state.json");
  recordGenTabEvent = typeof host?.recordEvent === "function" ? host.recordEvent : () => {};
}

export async function loadGenTabStoreState() {
  const raw = await readJsonFile(resolveStatePath());
  state = normalizeStoreState(raw);
}

export function serializeGenTabStoreState() {
  return {
    pendingById: cloneJsonValue(state.pendingById) ?? {},
    genTabsById: cloneJsonValue(state.genTabsById) ?? {},
  };
}

export function getGenTabRuntimeState(genId) {
  const normalizedGenId = `${genId ?? ""}`.trim();
  if (!normalizedGenId) {
    return {
      genId: "",
      pendingMetadata: null,
      gentab: null,
    };
  }

  return {
    genId: normalizedGenId,
    pendingMetadata: state.pendingById[normalizedGenId]
      ? cloneJsonValue(state.pendingById[normalizedGenId])
      : null,
    gentab: state.genTabsById[normalizedGenId]
      ? cloneJsonValue(state.genTabsById[normalizedGenId])
      : null,
  };
}

export async function setPendingGenTabMetadata(genId, metadata) {
  const normalizedGenId = `${genId ?? ""}`.trim();
  const normalizedMetadata = normalizePendingMetadata(metadata);
  if (!normalizedGenId || !normalizedMetadata) {
    throw new Error("缺少有效的 GenTab pending metadata");
  }

  state = {
    ...state,
    pendingById: {
      ...state.pendingById,
      [normalizedGenId]: normalizedMetadata,
    },
  };
  await persistGenTabStoreState();
  return getGenTabRuntimeState(normalizedGenId);
}

export async function clearPendingGenTabMetadata(genId) {
  const normalizedGenId = `${genId ?? ""}`.trim();
  if (!normalizedGenId || !state.pendingById[normalizedGenId]) {
    return getGenTabRuntimeState(normalizedGenId);
  }

  const nextPendingById = { ...state.pendingById };
  delete nextPendingById[normalizedGenId];
  state = {
    ...state,
    pendingById: nextPendingById,
  };
  await persistGenTabStoreState();
  return getGenTabRuntimeState(normalizedGenId);
}

export async function saveGenTabData(genId, gentab) {
  const normalizedGenId = `${genId ?? ""}`.trim();
  const normalizedData = normalizeGenTabData(gentab);
  if (!normalizedGenId || !normalizedData) {
    throw new Error("缺少有效的 GenTab 数据");
  }

  state = {
    ...state,
    genTabsById: {
      ...state.genTabsById,
      [normalizedGenId]: normalizedData,
    },
  };
  await persistGenTabStoreState();
  return getGenTabRuntimeState(normalizedGenId);
}

export async function clearGenTabData(genId) {
  const normalizedGenId = `${genId ?? ""}`.trim();
  if (!normalizedGenId || !state.genTabsById[normalizedGenId]) {
    return getGenTabRuntimeState(normalizedGenId);
  }

  const nextGenTabsById = { ...state.genTabsById };
  delete nextGenTabsById[normalizedGenId];
  state = {
    ...state,
    genTabsById: nextGenTabsById,
  };
  await persistGenTabStoreState();
  return getGenTabRuntimeState(normalizedGenId);
}
