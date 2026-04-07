import fs from "node:fs/promises";
import path from "node:path";

const maxStoredEntries = 500;

let resolveStatePath = () => path.join(process.cwd(), "turn-journal.json");
let recordTurnEvent = () => {};
let persistQueue = Promise.resolve();
let persistNonce = 0;
let state = { entries: [] };

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function createIsoTimestamp(input = Date.now()) {
  return new Date(input).toISOString();
}

function createJournalId() {
  return `journal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function readJsonFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeJournalEntry(rawEntry = {}) {
  return {
    journalId: isNonEmptyString(rawEntry?.journalId)
      ? rawEntry.journalId.trim()
      : createJournalId(),
    turnId: isNonEmptyString(rawEntry?.turnId) ? rawEntry.turnId.trim() : "",
    createdAt: isNonEmptyString(rawEntry?.createdAt)
      ? rawEntry.createdAt.trim()
      : createIsoTimestamp(),
    threadId: isNonEmptyString(rawEntry?.threadId) ? rawEntry.threadId.trim() : "",
    userText: typeof rawEntry?.userText === "string" ? rawEntry.userText : "",
    turnType: isNonEmptyString(rawEntry?.turnType) ? rawEntry.turnType.trim() : "",
    strategy: isNonEmptyString(rawEntry?.strategy) ? rawEntry.strategy.trim() : "",
    policyDecision: isNonEmptyString(rawEntry?.policyDecision)
      ? rawEntry.policyDecision.trim()
      : "",
    summary: typeof rawEntry?.summary === "string" ? rawEntry.summary : "",
    browserContext:
      rawEntry?.browserContext && typeof rawEntry.browserContext === "object"
        ? { ...rawEntry.browserContext }
        : null,
    skill:
      rawEntry?.skill && typeof rawEntry.skill === "object" ? { ...rawEntry.skill } : null,
    inputPolicy:
      rawEntry?.inputPolicy && typeof rawEntry.inputPolicy === "object"
        ? { ...rawEntry.inputPolicy }
        : null,
    executionContract:
      rawEntry?.executionContract && typeof rawEntry.executionContract === "object"
        ? {
            ...rawEntry.executionContract,
            requiredEvidence: Array.isArray(rawEntry.executionContract.requiredEvidence)
              ? [...rawEntry.executionContract.requiredEvidence]
              : [],
          }
        : null,
    receipt:
      rawEntry?.receipt && typeof rawEntry.receipt === "object"
        ? {
            ...rawEntry.receipt,
            trace:
              rawEntry.receipt.trace && typeof rawEntry.receipt.trace === "object"
                ? { ...rawEntry.receipt.trace }
                : null,
            evidence:
              rawEntry.receipt.evidence && typeof rawEntry.receipt.evidence === "object"
                ? { ...rawEntry.receipt.evidence }
                : null,
          }
        : null,
    response:
      rawEntry?.response && typeof rawEntry.response === "object"
        ? { ...rawEntry.response }
        : null,
    errorMessage: isNonEmptyString(rawEntry?.errorMessage) ? rawEntry.errorMessage.trim() : "",
    contextPackageSummary:
      rawEntry?.contextPackageSummary &&
      typeof rawEntry.contextPackageSummary === "object"
        ? { ...rawEntry.contextPackageSummary }
        : null,
  };
}

function normalizeJournalState(rawState) {
  return {
    entries: (Array.isArray(rawState?.entries) ? rawState.entries : [])
      .map((entry) => normalizeJournalEntry(entry))
      .slice(0, maxStoredEntries),
  };
}

function cloneExecutionContract(contract) {
  if (!contract || typeof contract !== "object") {
    return null;
  }

  return {
    ...contract,
    requiredEvidence: Array.isArray(contract.requiredEvidence)
      ? [...contract.requiredEvidence]
      : [],
  };
}

function buildJournalSearchHaystack(entry) {
  return [
    entry?.threadId,
    entry?.turnId,
    entry?.turnType,
    entry?.strategy,
    entry?.policyDecision,
    entry?.summary,
    entry?.userText,
    entry?.errorMessage,
    entry?.skill?.name,
    entry?.receipt?.status,
    entry?.receipt?.summary,
    entry?.receipt?.userVisibleMessage,
    entry?.executionContract?.sourceRoute,
    entry?.executionContract?.capabilitySource,
  ]
    .map((value) => `${value ?? ""}`.trim().toLowerCase())
    .filter(Boolean)
    .join("\n");
}

async function persistTurnJournalState() {
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
      recordTurnEvent("error", "turns", "持久化 turn journal 失败", {
        source: "main",
        kind: "turn-journal-persist-failure",
        details: { message: error instanceof Error ? error.message : String(error) },
      });
    }
  });

  persistQueue = queuedPersist;
  return queuedPersist;
}

export function initTurnJournalStore(host = {}) {
  resolveStatePath =
    typeof host?.resolveStatePath === "function"
      ? host.resolveStatePath
      : () => path.join(process.cwd(), "turn-journal.json");
  recordTurnEvent = typeof host?.recordEvent === "function" ? host.recordEvent : () => {};
}

export async function loadTurnJournalState() {
  const raw = await readJsonFile(resolveStatePath());
  state = normalizeJournalState(raw);
}

export function serializeTurnJournalState() {
  return {
    entries: state.entries.map((entry) => ({
      ...entry,
      browserContext: entry.browserContext ? { ...entry.browserContext } : null,
      skill: entry.skill ? { ...entry.skill } : null,
      inputPolicy: entry.inputPolicy ? { ...entry.inputPolicy } : null,
      executionContract: entry.executionContract
        ? cloneExecutionContract(entry.executionContract)
        : null,
      receipt: entry.receipt
        ? {
            ...entry.receipt,
            trace: entry.receipt.trace ? { ...entry.receipt.trace } : null,
            evidence: entry.receipt.evidence ? { ...entry.receipt.evidence } : null,
          }
        : null,
      response: entry.response ? { ...entry.response } : null,
      contextPackageSummary: entry.contextPackageSummary
        ? { ...entry.contextPackageSummary }
        : null,
    })),
  };
}

export async function recordTurnJournalEntry(entry) {
  const normalizedEntry = normalizeJournalEntry(entry);
  state = {
    entries: [normalizedEntry, ...state.entries].slice(0, maxStoredEntries),
  };
  await persistTurnJournalState();
  return normalizedEntry;
}

export function listTurnJournalEntries(options = {}) {
  const limit = Number.isFinite(options?.limit)
    ? Math.max(1, Math.min(100, Math.trunc(options.limit)))
    : 20;
  const threadId = isNonEmptyString(options?.threadId) ? options.threadId.trim() : "";
  const status = isNonEmptyString(options?.status) ? options.status.trim() : "";

  return state.entries
    .filter((entry) => (threadId ? entry.threadId === threadId : true))
    .filter((entry) => (status ? entry.receipt?.status === status : true))
    .slice(0, limit)
    .map((entry) => normalizeJournalEntry(entry));
}

export function searchTurnJournalEntries(query = "", options = {}) {
  const normalizedQuery = `${query ?? ""}`.trim().toLowerCase();
  if (!normalizedQuery) {
    return listTurnJournalEntries(options);
  }

  const limit = Number.isFinite(options?.limit)
    ? Math.max(1, Math.min(100, Math.trunc(options.limit)))
    : 20;

  return state.entries
    .filter((entry) => buildJournalSearchHaystack(entry).includes(normalizedQuery))
    .slice(0, limit)
    .map((entry) => normalizeJournalEntry(entry));
}

export function getTurnJournalStats() {
  const latest = state.entries[0] ?? null;
  const statusCounts = state.entries.reduce(
    (acc, entry) => {
      const status = isNonEmptyString(entry?.receipt?.status)
        ? entry.receipt.status.trim()
        : "unknown";
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    },
    { completed: 0, failed: 0, blocked: 0, unknown: 0 },
  );

  return {
    path: resolveStatePath(),
    count: state.entries.length,
    latestCreatedAt: latest?.createdAt ?? null,
    latestThreadId: latest?.threadId ?? null,
    latestTurnId: latest?.turnId ?? null,
    latestStatus: latest?.receipt?.status ?? null,
    statusCounts,
  };
}

export async function pruneTurnJournalEntries(options = {}) {
  const keepLatest = Number.isFinite(options?.keepLatest)
    ? Math.max(0, Math.min(maxStoredEntries, Math.trunc(options.keepLatest)))
    : maxStoredEntries;
  const beforeCount = state.entries.length;

  state = {
    entries: state.entries.slice(0, keepLatest),
  };

  if (state.entries.length !== beforeCount) {
    await persistTurnJournalState();
  }

  return {
    ok: true,
    removed: Math.max(0, beforeCount - state.entries.length),
    stats: getTurnJournalStats(),
  };
}
