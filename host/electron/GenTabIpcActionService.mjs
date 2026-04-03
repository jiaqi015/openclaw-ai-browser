import { getContextSnapshotForTab } from "../../runtime/browser/TabContextService.mjs";
import {
  buildGenTabPrompt,
  extractJsonFromOutput,
  normalizeGeneratedGenTab,
} from "../../runtime/browser/GenTabGenerationService.mjs";
import { buildBrowserContextPackageFromTabSet } from "../../runtime/browser/BrowserContextPackageService.mjs";
import { executeGenTabTurn } from "../../runtime/turns/TurnEngine.mjs";
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

  if (referenceTabIds.length === 0) {
    return { success: false, error: "请至少提供一个来源标签页" };
  }

  const turnResult = await runGenTabTurn(
    {
      referenceTabIds,
      userIntent,
      preferredType,
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

  if (!turnResult.ok) {
    return {
      success: false,
      error: turnResult.receipt.userVisibleMessage,
      contextPackage: turnResult.contextPackage ?? null,
      executionPlan: turnResult.executionPlan ?? null,
    };
  }

  return {
    success: true,
    gentab: turnResult.gentab,
    contextPackage: turnResult.contextPackage,
    executionPlan: turnResult.executionPlan,
  };
}
