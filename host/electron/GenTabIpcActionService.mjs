import { getContextSnapshotForTab } from "../../runtime/browser/TabContextService.mjs";
import {
  clearPendingGenTabMetadata,
  saveGenTabData,
} from "../../runtime/browser/GenTabStore.mjs";
import {
  buildGenTabPrompt,
  extractJsonFromOutput,
  normalizeGeneratedGenTab,
} from "../../runtime/browser/GenTabGenerationService.mjs";
import { buildBrowserContextPackageFromTabSet } from "../../runtime/browser/BrowserContextPackageService.mjs";
import { executeGenTabTurn } from "../../runtime/turns/TurnEngine.mjs";
import { buildTurnJournalEntry } from "../../runtime/turns/TurnJournalService.mjs";
import { recordTurnJournalEntry } from "../../runtime/turns/TurnJournalStore.mjs";
import { runLocalAgentTurn } from "../../runtime/openclaw/OpenClawManager.mjs";

function normalizeReferenceTabIds(value) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((tabId) => `${tabId ?? ""}`.trim()).filter(Boolean)))
    : [];
}

export async function generateGenTab(payload = {}, dependencies = {}) {
  const referenceTabIds = normalizeReferenceTabIds(payload?.referenceTabIds);
  const userIntent = payload?.userIntent;
  const preferredType = payload?.preferredType;
  const uiLocale = payload?.uiLocale;
  const assistantLocaleMode = payload?.assistantLocaleMode;
  const buildContextPackage =
    typeof dependencies?.buildBrowserContextPackageFromTabSet === "function"
      ? dependencies.buildBrowserContextPackageFromTabSet
      : buildBrowserContextPackageFromTabSet;
  const getContextSnapshot =
    typeof dependencies?.getContextSnapshotForTab === "function"
      ? dependencies.getContextSnapshotForTab
      : getContextSnapshotForTab;
  const runAgentTurn =
    typeof dependencies?.runLocalAgentTurn === "function"
      ? dependencies.runLocalAgentTurn
      : runLocalAgentTurn;
  const runGenTabTurn =
    typeof dependencies?.executeGenTabTurn === "function"
      ? dependencies.executeGenTabTurn
      : executeGenTabTurn;
  const persistGenTabData =
    typeof dependencies?.saveGenTabData === "function"
      ? dependencies.saveGenTabData
      : saveGenTabData;
  const clearPendingMetadata =
    typeof dependencies?.clearPendingGenTabMetadata === "function"
      ? dependencies.clearPendingGenTabMetadata
      : clearPendingGenTabMetadata;
  const genId = `${payload?.genId ?? ""}`.trim();

  if (referenceTabIds.length === 0) {
    return { success: false, error: "请至少提供一个来源标签页" };
  }

  const turnResult = await runGenTabTurn(
    {
      referenceTabIds,
      userIntent,
      preferredType,
      uiLocale,
      assistantLocaleMode,
    },
    {
      buildBrowserContextPackageFromTabSet: buildContextPackage,
      getContextSnapshotForTab: getContextSnapshot,
      runLocalAgentTurn: runAgentTurn,
      buildGenTabPrompt,
      extractJsonFromOutput,
      normalizeGeneratedGenTab,
    },
  );

  const journalEntry = await recordTurnJournalEntry(
    buildTurnJournalEntry({
      threadId: `${payload?.threadId ?? ""}`.trim(),
      userText: typeof userIntent === "string" ? userIntent : "",
      plan: turnResult?.executionPlan,
      receipt: turnResult?.receipt,
      contextPackage: turnResult?.contextPackage,
      response: turnResult?.response,
      error: turnResult?.error,
    }),
  );

  if (!turnResult.ok) {
    return {
      success: false,
      error: turnResult.receipt.userVisibleMessage,
      contextPackage: turnResult.contextPackage ?? null,
      executionPlan: turnResult.executionPlan ?? null,
      journalEntryId: journalEntry.journalId,
    };
  }

  if (genId) {
    await persistGenTabData(genId, turnResult.gentab);
    await clearPendingMetadata(genId);
  }

  return {
    success: true,
    gentab: turnResult.gentab,
    contextPackage: turnResult.contextPackage,
    executionPlan: turnResult.executionPlan,
    journalEntryId: journalEntry.journalId,
  };
}
