import { getContextSnapshotForTab } from "../../runtime/browser/TabContextService.mjs";
import {
  clearPendingGenTabMetadata,
  getGenTabRuntimeState,
  saveGenTabData,
} from "../../runtime/browser/GenTabStore.mjs";
import {
  buildGenTabPrompt,
  buildRefreshItemPrompt,
  extractJsonFromOutput,
  normalizeGeneratedGenTab,
  normalizeRefreshedItem,
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

/**
 * Refresh a single GenTab item by re-extracting its fields from a fresh
 * snapshot of its bound source tab. This is the closed loop for the Live
 * Cells feature: users click a row's refresh button, we call the agent with
 * the row as a template and the latest page content, then merge the result
 * back into the stored GenTab.
 *
 * Intentionally bypasses TurnEngine — that pipeline is scoped to full GenTab
 * generation and would rebuild a full context package for every cell click.
 */
export async function refreshGenTabItem(payload = {}, dependencies = {}) {
  const genId = `${payload?.genId ?? ""}`.trim();
  const itemId = `${payload?.itemId ?? ""}`.trim();
  const assistantLocaleMode = payload?.assistantLocaleMode;

  if (!genId) {
    return { success: false, error: "缺少 GenTab id" };
  }
  if (!itemId) {
    return { success: false, error: "缺少 item id" };
  }

  const getContextSnapshot =
    typeof dependencies?.getContextSnapshotForTab === "function"
      ? dependencies.getContextSnapshotForTab
      : getContextSnapshotForTab;
  const runAgentTurn =
    typeof dependencies?.runLocalAgentTurn === "function"
      ? dependencies.runLocalAgentTurn
      : runLocalAgentTurn;
  const persistGenTabData =
    typeof dependencies?.saveGenTabData === "function"
      ? dependencies.saveGenTabData
      : saveGenTabData;
  const readGenTabRuntimeState =
    typeof dependencies?.getGenTabRuntimeState === "function"
      ? dependencies.getGenTabRuntimeState
      : getGenTabRuntimeState;

  const runtimeState = readGenTabRuntimeState(genId);
  const gentab = runtimeState?.gentab;
  if (!gentab || !Array.isArray(gentab.items)) {
    return { success: false, error: "GenTab 数据不存在" };
  }

  const originalItem = gentab.items.find((candidate) => candidate?.id === itemId);
  if (!originalItem) {
    return { success: false, error: "未找到对应的 item" };
  }

  const sourceTabId = `${originalItem.sourceTabId ?? ""}`.trim();
  if (!sourceTabId) {
    return {
      success: false,
      error: "该 item 未记录源标签页，无法刷新",
    };
  }

  let context;
  try {
    context = await getContextSnapshot(sourceTabId);
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? `无法读取源标签页：${error.message}`
          : "无法读取源标签页",
    };
  }

  const assistantLocale =
    assistantLocaleMode === "match-ui" || assistantLocaleMode === "zh-CN"
      ? "zh-CN"
      : assistantLocaleMode === "en"
        ? "en"
        : "zh-CN";

  const prompt = buildRefreshItemPrompt({
    item: originalItem,
    context,
    userIntent: gentab?.metadata?.userIntent,
    assistantLocale,
  });

  let response;
  try {
    response = await runAgentTurn({ message: prompt });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (!response || !response.text) {
    return { success: false, error: "模型未返回有效内容" };
  }

  let parsed;
  try {
    parsed = JSON.parse(extractJsonFromOutput(response.text));
  } catch {
    return { success: false, error: "模型返回的 JSON 无法解析" };
  }

  if (!parsed?.success || !parsed?.item) {
    return {
      success: false,
      error: parsed?.error || "模型拒绝刷新该 item",
    };
  }

  const nextItem = normalizeRefreshedItem(parsed.item, originalItem);
  if (!nextItem) {
    return { success: false, error: "刷新结果无法归一化" };
  }

  const nextGenTab = {
    ...gentab,
    items: gentab.items.map((candidate) =>
      candidate?.id === itemId ? nextItem : candidate,
    ),
    metadata: {
      ...gentab.metadata,
      // record the most recent cell refresh so UI can show "just refreshed"
      lastCellRefreshAt: new Date().toISOString(),
    },
  };

  try {
    await persistGenTabData(genId, nextGenTab);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    success: true,
    item: nextItem,
    gentab: nextGenTab,
  };
}
