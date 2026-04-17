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
import {
  buildCodingGenTabPlanPrompt,
  buildCodingGenTabPrompt,
  buildCodingGenTabRefinementPrompt,
  buildCodingGenTabVerifyPrompt,
  normalizeCodingGenTabPlan,
  normalizeCodingGenTabResult,
  normalizeCodingGenTabVerifyResult,
} from "../../runtime/browser/GenTabCodingService.mjs";
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

/**
 * Coding GenTab — the creative coding agent path.
 *
 * Instead of asking the agent to output structured JSON data that gets piped
 * through a renderer, we ask it to produce a self-contained interactive HTML
 * file. The result is stored in GenTabStore with schemaVersion "coding" and
 * rendered via an iframe on the frontend.
 *
 * Two-pass generation:
 *             If it finds issues it returns fixed HTML; otherwise {"ok":true}.
 *             This pass is best-effort: failure falls back to pass 1 output.
 * Refinement runs skip the verify pass (already passed verification once).
 */
export async function generateCodingGenTab(payload = {}, dependencies = {}) {
  const genId = `${payload?.genId ?? ""}`.trim();
  const referenceTabIds = normalizeReferenceTabIds(payload?.referenceTabIds);
  const userIntent = `${payload?.userIntent ?? ""}`.trim();
  const assistantLocaleMode = payload?.assistantLocaleMode;
  // Refinement fields — present only when refining an existing GenTab
  const refinementText = `${payload?.refinementText ?? ""}`.trim();
  const originalHtml = `${payload?.originalHtml ?? ""}`.trim();

  if (!genId) return { success: false, error: "缺少 GenTab id" };
  if (referenceTabIds.length === 0) return { success: false, error: "请至少提供一个来源标签页" };

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
  const clearPendingMetadata =
    typeof dependencies?.clearPendingGenTabMetadata === "function"
      ? dependencies.clearPendingGenTabMetadata
      : clearPendingGenTabMetadata;
  const sendProgress =
    typeof dependencies?.sendProgress === "function"
      ? dependencies.sendProgress
      : () => {};

  const assistantLocale = assistantLocaleMode === "en" ? "en" : "zh-CN";

  // Step 1: Gather context snapshots
  const contexts = [];
  for (const tabId of referenceTabIds) {
    try {
      const ctx = await getContextSnapshot(tabId);
      if (ctx) contexts.push(ctx);
    } catch { /* skip */ }
  }

  if (contexts.length === 0) {
    return { success: false, error: "无法读取来源网页，请检查网络或页面状态。" };
  }

  sendProgress("reading", `已读取 ${contexts.length} 个来源页`);

  const isRefinement = refinementText.length > 0 && originalHtml.length > 100;

  // Step 2 & 3: Combined Planning + Coding
  // To reduce latency, we skip the explicit planning turn and let the coding agent
  // decide the design within a single combined prompt.
  sendProgress("coding", "正在构思并编写代码…");

  const prompt = isRefinement
    ? buildCodingGenTabRefinementPrompt(refinementText, originalHtml, contexts, assistantLocale)
    : buildCodingGenTabPrompt(userIntent, contexts, assistantLocale, null /* combined pass */);

  let response;
  try {
    response = await runAgentTurn({ message: prompt });
  } catch (error) {
    return {
      success: false,
      error: `生成失败：${error instanceof Error ? error.message : String(error)}`,
    };
  }

  if (!response?.text) {
    return { success: false, error: "模型未返回内容，请稍后再试。" };
  }

  const result = normalizeCodingGenTabResult(response.text, {
    sourceTabIds: referenceTabIds,
    userIntent,
  });

  if (!result) return { success: false, error: "生成内容解析失败，请尝试简化描述或更换模型。" };
  if (!result.success) return { success: false, error: result.error };

  // Step 4: Verification pass (optional/best-effort)
  // We keep this for now but it's the next candidate for removal if speed is still an issue.
  let finalHtml = result.html;
  if (!isRefinement) {
    sendProgress("checking", "正在进行最后的代码质量检查…");
    try {
      const verifyPrompt = buildCodingGenTabVerifyPrompt(result.html, contexts, assistantLocale, null);
      const verifyResponse = await runAgentTurn({ message: verifyPrompt });
      if (verifyResponse?.text) {
        const verifyResult = normalizeCodingGenTabVerifyResult(verifyResponse.text);
        if (verifyResult && !verifyResult.ok && verifyResult.html) {
          finalHtml = verifyResult.html;
        }
      }
    } catch { /* best effort */ }
  }

  const wasFixed = finalHtml !== result.html;
  sendProgress("done", wasFixed ? "完成（已自动优化代码细节）" : "生成完成");

  const finalResult = wasFixed ? { ...result, html: finalHtml } : result;

  try {
    await persistGenTabData(genId, finalResult);
    await clearPendingMetadata(genId);
  } catch (error) {
    return { success: false, error: `保存失败：${error instanceof Error ? error.message : String(error)}` };
  }

  return { success: true, gentab: finalResult, wasFixed };
}

