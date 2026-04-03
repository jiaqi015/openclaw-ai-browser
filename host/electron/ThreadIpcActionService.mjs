import { getActiveTabId } from "../../runtime/browser/TabManager.mjs";
import { buildBrowserAiPrompt } from "../../runtime/browser/BrowserAiPromptService.mjs";
import { buildBrowserContextPackage } from "../../runtime/browser/BrowserContextPackageService.mjs";
import {
  ensureSabrinaBrowserAgent,
  getOpenClawSessionId,
  runGatewayChatCompletion,
  runLocalAgentTurn,
  runLocalSkillTurn,
} from "../../runtime/openclaw/OpenClawManager.mjs";
import {
  ensureRequestedSkillModel,
  refreshOpenClawRuntimeState,
} from "../../runtime/openclaw/OpenClawRuntimeService.mjs";
import { recordOpenClawTask } from "../../runtime/openclaw/OpenClawTaskStore.mjs";

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function shouldFallbackFromSkill(error, skillName) {
  const message = getErrorMessage(error);
  const normalizedSkillName = `${skillName ?? ""}`.trim();
  if (!message || !normalizedSkillName) {
    return false;
  }

  return (
    message.includes(`OpenClaw skill ${normalizedSkillName} 当前不可直接使用`) ||
    message.includes(`OpenClaw skill ${normalizedSkillName} 没有确认执行成功`) ||
    message.includes(`OpenClaw 未返回技能回执 [SKILL_USED:${normalizedSkillName}`) ||
    /Missing [A-Z0-9_]+ environment variable/i.test(message)
  );
}

function getSkillTraceFromError(error) {
  if (!error || typeof error !== "object") {
    return null;
  }

  return error.skillTrace && typeof error.skillTrace === "object"
    ? error.skillTrace
    : null;
}

function toFallbackSkillTrace(trace, params) {
  const skillName = `${params?.skillName ?? trace?.skillName ?? ""}`.trim();
  const failureReason = `${params?.failureReason ?? trace?.failureReason ?? ""}`.trim();
  const baseSteps = Array.isArray(trace?.steps) ? trace.steps.filter(Boolean) : [];
  const nextSteps = [...baseSteps];
  const lastStep = nextSteps[nextSteps.length - 1];
  if (lastStep?.type !== "final" || lastStep?.title !== "已回退为普通对话") {
    nextSteps.push({
      type: "final",
      title: "已回退为普通对话",
      detail: failureReason || "技能执行失败，本次改为普通对话。",
      isError: true,
    });
  }

  return {
    runId: trace?.runId || `${skillName}:${Date.now()}`,
    requestId: trace?.requestId || undefined,
    skillName,
    status: "fallback",
    failureReason: failureReason || undefined,
    steps: nextSteps,
  };
}

let defaultRecordAiTurnPromise = null;

async function getDefaultRecordAiTurn() {
  if (!defaultRecordAiTurnPromise) {
    defaultRecordAiTurnPromise = import("./monitoring.mjs").then(
      (monitoring) => monitoring.recordAiTurn,
    );
  }

  return defaultRecordAiTurnPromise;
}

export async function runAiAction(payload, services = {}) {
  const startedAt = Date.now();
  const resolveActiveTabId =
    typeof services.getActiveTabId === "function" ? services.getActiveTabId : getActiveTabId;
  const packageBrowserContext =
    typeof services.buildBrowserContextPackage === "function"
      ? services.buildBrowserContextPackage
      : buildBrowserContextPackage;
  const ensureBrowserAgent =
    typeof services.ensureSabrinaBrowserAgent === "function"
      ? services.ensureSabrinaBrowserAgent
      : ensureSabrinaBrowserAgent;
  const resolveSessionId =
    typeof services.getOpenClawSessionId === "function"
      ? services.getOpenClawSessionId
      : getOpenClawSessionId;
  const buildPrompt =
    typeof services.buildBrowserAiPrompt === "function"
      ? services.buildBrowserAiPrompt
      : buildBrowserAiPrompt;
  const ensureSkillModel =
    typeof services.ensureRequestedSkillModel === "function"
      ? services.ensureRequestedSkillModel
      : ensureRequestedSkillModel;
  const refreshRuntimeState =
    typeof services.refreshOpenClawRuntimeState === "function"
      ? services.refreshOpenClawRuntimeState
      : refreshOpenClawRuntimeState;
  const runGatewayTurn =
    typeof services.runGatewayChatCompletion === "function"
      ? services.runGatewayChatCompletion
      : runGatewayChatCompletion;
  const runSkillTurn =
    typeof services.runLocalSkillTurn === "function"
      ? services.runLocalSkillTurn
      : runLocalSkillTurn;
  const recordTurn =
    typeof services.recordAiTurn === "function"
      ? services.recordAiTurn
      : await getDefaultRecordAiTurn();
  const requestedTabId =
    typeof payload?.tabId === "string" && payload.tabId.trim()
      ? payload.tabId.trim()
      : null;
  const currentTabId = resolveActiveTabId();
  const resolvedTabId = requestedTabId ?? currentTabId;
  const contextPackage = payload?.contextPackage?.primary
    ? payload.contextPackage
    : await packageBrowserContext({
        activeTabId: resolvedTabId,
        referenceTabIds: Array.isArray(payload?.referenceTabIds)
          ? payload.referenceTabIds
          : [],
      }, {
        getContextSnapshotForTab: payload?.getContextSnapshotForTab,
      });
  const context = contextPackage.primary ?? null;

  if (payload.action === "explain-selection" && !context.selectedText) {
    throw new Error('请先在网页里选中一段文本，再使用“解释选中文本”。');
  }

  const agentId =
    typeof payload?.agentId === "string" && payload.agentId.trim()
      ? payload.agentId.trim()
      : (await ensureBrowserAgent()).agentId;

  const sessionId =
    typeof payload?.sessionId === "string" && payload.sessionId.trim()
      ? payload.sessionId.trim()
      : resolveSessionId(`${payload?.tabId ?? currentTabId ?? ""}`.trim());

  const builtPrompt = buildPrompt({
    action: payload.action,
    prompt: payload.prompt,
    contextPackage,
  });
  const requestedSkillName =
    typeof payload?.skillName === "string" && payload.skillName.trim()
      ? payload.skillName.trim()
      : "";
  const requestedSkillMode = payload?.skillMode === "assist" ? "assist" : "strict";
  const actionName = requestedSkillName ? `skill:${requestedSkillName}` : payload.action;
  const requestedModel =
    typeof payload?.model === "string" && payload.model.trim()
      ? payload.model.trim()
      : "";

  try {
    let response = null;
    let recordedActionName = actionName;
    let skillFallback = false;
    let skillFailureReason = "";
    let skillTrace = null;

    if (requestedSkillName) {
      try {
        await ensureSkillModel(agentId, requestedModel);
        const skillResponse = await runSkillTurn({
          skillName: requestedSkillName,
          action: payload.action,
          prompt: payload.prompt,
          contextPackage,
          agentId,
          sessionId,
          thinking: "low",
        });
        response = {
          text: skillResponse.text,
          sessionId: skillResponse.sessionId,
          model: skillResponse.model,
          provider: skillResponse.provider,
          durationMs: skillResponse.durationMs,
        };
        skillTrace = skillResponse.skillTrace ?? null;
      } catch (error) {
        const canAssistFallback =
          requestedSkillMode === "assist" &&
          shouldFallbackFromSkill(error, requestedSkillName);
        if (!canAssistFallback) {
          throw error;
        }

        skillFallback = true;
        skillFailureReason = getErrorMessage(error);
        skillTrace = toFallbackSkillTrace(getSkillTraceFromError(error), {
          skillName: requestedSkillName,
          failureReason: skillFailureReason,
        });
        response = await runGatewayTurn({
          agentId,
          model: requestedModel,
          message: builtPrompt,
          sessionKey: sessionId,
        });
        recordedActionName = `${payload.action}:fallback-from-skill:${requestedSkillName}`;
      }
    } else {
      response = await runGatewayTurn({
        agentId,
        model: requestedModel,
        message: builtPrompt,
        sessionKey: sessionId,
      });
    }

    const finalMessage = `${response.text || "模型没有返回可显示的文本。"}`.trim();
    recordTurn({
      action: recordedActionName,
      agentId,
      model: response.model || payload.model || "",
      durationMs: Date.now() - startedAt,
      ok: true,
      tabId: resolvedTabId,
      sessionId,
      promptChars: builtPrompt.length,
      responseChars: finalMessage.length,
    });

    if (requestedSkillName) {
      await refreshRuntimeState();
    }

    return {
      message: finalMessage,
      context,
      contextPackage,
      sessionId: response.sessionId || sessionId,
      agentId,
      model: response.model || payload.model || "",
      skillName: requestedSkillName || undefined,
      skillMode: requestedSkillName ? requestedSkillMode : undefined,
      skillFallback,
      skillFailureReason: skillFailureReason || undefined,
      skillTrace: skillTrace || undefined,
    };
  } catch (error) {
    if (requestedSkillName) {
      await refreshRuntimeState().catch(() => {});
    }

    recordTurn({
      action: actionName,
      agentId,
      model: requestedModel,
      durationMs: Date.now() - startedAt,
      ok: false,
      tabId: resolvedTabId,
      sessionId,
      promptChars: builtPrompt.length,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function runTrackedLocalAgentTask(payload) {
  const startedAt = Date.now();

  try {
    const response = await runLocalAgentTurn(payload ?? {});
    await recordOpenClawTask({
      kind: "handoff",
      agentId: `${payload?.agentId ?? "main"}`.trim() || "main",
      title: `${payload?.task?.title ?? "龙虾异步任务"}`.trim() || "龙虾异步任务",
      promptPreview: `${payload?.task?.promptPreview ?? payload?.message ?? ""}`.trim().slice(0, 240),
      sourceUrl: `${payload?.task?.sourceUrl ?? ""}`.trim(),
      threadId: `${payload?.task?.threadId ?? ""}`.trim(),
      sessionId: response.sessionId || `${payload?.sessionId ?? ""}`.trim(),
      model: response.model || "",
      status: "completed",
      responseText: response.text,
      createdAt: new Date(startedAt).toISOString(),
      updatedAt: new Date().toISOString(),
      durationMs: Number.isFinite(response.durationMs) ? response.durationMs : Date.now() - startedAt,
    });
    return response;
  } catch (error) {
    await recordOpenClawTask({
      kind: "handoff",
      agentId: `${payload?.agentId ?? "main"}`.trim() || "main",
      title: `${payload?.task?.title ?? "龙虾异步任务"}`.trim() || "龙虾异步任务",
      promptPreview: `${payload?.task?.promptPreview ?? payload?.message ?? ""}`.trim().slice(0, 240),
      sourceUrl: `${payload?.task?.sourceUrl ?? ""}`.trim(),
      threadId: `${payload?.task?.threadId ?? ""}`.trim(),
      sessionId: `${payload?.sessionId ?? ""}`.trim(),
      model: "",
      status: "failed",
      responseText: "",
      errorMessage: error instanceof Error ? error.message : String(error),
      createdAt: new Date(startedAt).toISOString(),
      updatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}
