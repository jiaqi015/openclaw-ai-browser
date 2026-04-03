import {
  buildBrowserContextPackage,
  buildBrowserContextPackageFromTabSet,
} from "../browser/BrowserContextPackageService.mjs";
import {
  buildGenTabPrompt,
  extractJsonFromOutput,
  normalizeGeneratedGenTab,
} from "../browser/GenTabGenerationService.mjs";
import { resolveBrowserSkillInputPlan } from "../openclaw/BrowserSkillInputPolicyService.mjs";
import { planTurnExecution } from "./TurnPlanner.mjs";
import {
  buildBlockedTurnReceipt,
  buildCompletedTurnReceipt,
  buildFailedTurnReceipt,
} from "./TurnReceiptService.mjs";
import {
  getAssistantLanguageInstruction,
  normalizeUiLocale,
  resolveAssistantLocale,
  translate,
} from "../../shared/localization.mjs";

function normalizeNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function getTurnLocales(payload = {}) {
  const actionPayload = payload?.actionPayload ?? {};
  const taskPayload = payload?.taskPayload ?? {};
  const uiLocale = normalizeUiLocale(
    actionPayload?.uiLocale ?? taskPayload?.uiLocale ?? payload?.uiLocale,
  );

  return {
    uiLocale,
    assistantLocale: resolveAssistantLocale(
      uiLocale,
      actionPayload?.assistantLocaleMode ??
        taskPayload?.assistantLocaleMode ??
        payload?.assistantLocaleMode,
    ),
  };
}

function buildOpenClawTaskPrompt(params = {}) {
  const prompt = normalizeNonEmptyString(params?.prompt);
  const contextPackage = params?.contextPackage ?? null;
  const context = contextPackage?.primary ?? null;
  const assistantLocale = resolveAssistantLocale(
    params?.uiLocale,
    params?.assistantLocaleMode,
  );
  const references = Array.isArray(contextPackage?.references)
    ? contextPackage.references
    : [];
  const attachmentBlock = references.length
    ? references
        .map((attachment, index) =>
          [
            `引用页面 ${index + 1}：${attachment.context.title}`,
            `引用 URL：${attachment.context.url}`,
            attachment.context.selectedText
              ? `引用页选中文本：\n${attachment.context.selectedText}`
              : "",
            `引用页摘要：\n${attachment.context.leadText || attachment.context.contentPreview || "暂无摘要。"}`,
          ]
            .filter(Boolean)
            .join("\n\n"),
        )
        .join("\n\n---\n\n")
    : "";

  return [
    "请把下面这个浏览器任务当成需要继续处理的工作项。",
    `当前页面：${context?.title || "当前页面"}`,
    `当前 URL：${context?.url || ""}`,
    context?.selectedText ? `用户当前选中文本：\n${context.selectedText}` : "",
    `页面摘要：\n${context?.leadText || context?.contentPreview || "当前页面暂无摘要。"}`,
    attachmentBlock ? `额外引用页面：\n\n${attachmentBlock}` : "",
    `用户意图：\n${prompt || "请继续处理当前页面相关任务。"}`,
    getAssistantLanguageInstruction(assistantLocale),
    "请先确认你会怎么处理，再给出下一步建议或结果。",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function packageContextFromPayload(payload, dependencies) {
  const activeTabId = normalizeNonEmptyString(
    payload?.actionPayload?.tabId ?? payload?.taskPayload?.tabId,
  );
  return buildBrowserContextPackage(
    {
      activeTabId,
      referenceTabIds: payload?.referenceTabIds,
    },
    dependencies,
  );
}

async function resolveAiTurnCapability(payload, contextPackage, dependencies) {
  const actionPayload = payload?.actionPayload ?? {};
  const skillName = normalizeNonEmptyString(actionPayload?.skillName);
  if (!skillName) {
    return null;
  }

  const skillMode = actionPayload?.skillMode === "assist" ? "assist" : "strict";

  if (typeof dependencies?.getLocalSkillDetail !== "function") {
    return {
      kind: "skill",
      skillName,
      skillMode,
      skill: null,
      inputPlan: null,
      resolutionError: "当前没有可用的 skill 详情解析器。",
    };
  }

  try {
    const skill = await dependencies.getLocalSkillDetail(skillName);
    return {
      kind: "skill",
      skillName,
      skillMode,
      skill,
      inputPlan: resolveBrowserSkillInputPlan({
        skill,
        context: contextPackage,
      }),
      resolutionError: "",
    };
  } catch (error) {
    return {
      kind: "skill",
      skillName,
      skillMode,
      skill: null,
      inputPlan: null,
      resolutionError: getErrorMessage(error),
    };
  }
}

async function packageContextFromTabSetPayload(payload, dependencies) {
  const referenceTabIds = Array.isArray(payload?.referenceTabIds)
    ? payload.referenceTabIds
    : [];
  const buildContextPackage =
    typeof dependencies?.buildBrowserContextPackageFromTabSet === "function"
      ? dependencies.buildBrowserContextPackageFromTabSet
      : buildBrowserContextPackageFromTabSet;

  return buildContextPackage(
    {
      tabIds: referenceTabIds,
    },
    dependencies,
  );
}

export async function executeAiTurn(payload = {}, dependencies = {}) {
  const actionPayload = payload?.actionPayload ?? {};
  const { uiLocale, assistantLocale } = getTurnLocales(payload);
  const contextPackage = await packageContextFromPayload(payload, dependencies);
  const capability = await resolveAiTurnCapability(
    payload,
    contextPackage,
    dependencies,
  );
  const plan = planTurnExecution({
    intent: {
      type: normalizeNonEmptyString(actionPayload?.skillName) ? "skill" : "ask",
      actionPayload,
    },
    contextPackage,
    capability,
  });

  if (
    plan.strategy === "strict_skill_execution" &&
    plan.policyDecision === "reject"
  ) {
    return {
      ok: false,
      contextPackage,
      executionPlan: plan,
      error: new Error(
        normalizeNonEmptyString(plan?.inputPolicy?.failureReason) ||
          translate(uiLocale, "error.incompatibleSkillInput"),
      ),
      receipt: buildBlockedTurnReceipt({
        plan,
        contextPackage,
        uiLocale,
        message:
          normalizeNonEmptyString(plan?.inputPolicy?.failureReason) ||
          translate(uiLocale, "error.incompatibleSkillInput"),
      }),
    };
  }

  try {
    const response = await dependencies.runAiAction({
      ...actionPayload,
      contextPackage,
      uiLocale,
      assistantLocale,
    });

    return {
      ok: true,
      contextPackage,
      executionPlan: plan,
      response,
      receipt: buildCompletedTurnReceipt({
        plan,
        contextPackage,
        response,
        uiLocale,
        requestedSkillName: normalizeNonEmptyString(actionPayload?.skillName),
      }),
    };
  } catch (error) {
    return {
      ok: false,
      contextPackage,
      executionPlan: plan,
      error,
      receipt: buildFailedTurnReceipt({
        plan,
        contextPackage,
        error,
        uiLocale,
        executionAttempted: true,
      }),
    };
  }
}

export async function executeOpenClawTaskTurn(payload = {}, dependencies = {}) {
  const taskPayload = payload?.taskPayload ?? {};
  const { uiLocale, assistantLocale } = getTurnLocales(payload);
  const prompt = normalizeNonEmptyString(taskPayload?.prompt);
  const contextPackage = await packageContextFromPayload(payload, dependencies);
  const context = contextPackage.primary ?? null;
  const taskTitle = context?.title || translate(uiLocale, "common.currentPageTask");
  const plan = planTurnExecution({
    intent: {
      type: "handoff",
      taskPayload,
    },
    contextPackage,
    capability: null,
  });

  try {
    const response = await dependencies.runLocalAgentTask({
      agentId: taskPayload?.agentId,
      sessionId: taskPayload?.sessionId,
      thinking: taskPayload?.thinking,
      message: buildOpenClawTaskPrompt({
        prompt,
        contextPackage,
        uiLocale,
        assistantLocaleMode: taskPayload?.assistantLocaleMode,
      }),
      task: {
        title: taskTitle,
        promptPreview: (prompt || payload?.userText || "").slice(0, 240),
        sourceUrl: context?.url || "",
        threadId: payload?.threadId,
      },
    });

    return {
      ok: true,
      contextPackage,
      executionPlan: plan,
      response,
      receipt: buildCompletedTurnReceipt({
        plan,
        contextPackage,
        response,
        uiLocale,
        taskTitle,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      contextPackage,
      executionPlan: plan,
      error,
      receipt: buildFailedTurnReceipt({
        plan,
        contextPackage,
        error,
        uiLocale,
        executionAttempted: true,
      }),
    };
  }
}

export async function executeGenTabTurn(payload = {}, dependencies = {}) {
  const { uiLocale, assistantLocale } = getTurnLocales(payload);
  const userIntent = normalizeNonEmptyString(payload?.userIntent);
  const preferredType = payload?.preferredType;
  const referenceTabIds = Array.isArray(payload?.referenceTabIds)
    ? payload.referenceTabIds.filter((tabId) => normalizeNonEmptyString(tabId))
    : [];
  const buildPrompt =
    typeof dependencies?.buildGenTabPrompt === "function"
      ? dependencies.buildGenTabPrompt
      : buildGenTabPrompt;
  const extractJson =
    typeof dependencies?.extractJsonFromOutput === "function"
      ? dependencies.extractJsonFromOutput
      : extractJsonFromOutput;
  const normalizeGentab =
    typeof dependencies?.normalizeGeneratedGenTab === "function"
      ? dependencies.normalizeGeneratedGenTab
      : normalizeGeneratedGenTab;
  const runAgentTurn = dependencies?.runLocalAgentTurn;

  if (referenceTabIds.length === 0) {
    throw new Error(translate(uiLocale, "error.requireSourceTabs"));
  }
  if (typeof runAgentTurn !== "function") {
    throw new Error(translate(uiLocale, "error.gentabExecutorUnavailable"));
  }

  const contextPackage = await packageContextFromTabSetPayload(payload, dependencies);
  const plan = planTurnExecution({
    intent: {
      type: "gentab",
      genTabPayload: {
        referenceTabIds,
        preferredType,
      },
    },
    contextPackage,
    capability: null,
  });

  try {
    if (!contextPackage?.primary) {
      throw new Error(translate(uiLocale, "error.noTabContent"));
    }

    const prompt = buildPrompt(userIntent, contextPackage, preferredType, assistantLocale);
    const response = await runAgentTurn({
      message: prompt,
    });

    if (!response || !response.text) {
      throw new Error(translate(uiLocale, "error.aiNoResult"));
    }

    let parsed;
    try {
      parsed = JSON.parse(extractJson(response.text));
    } catch {
      throw new Error(translate(uiLocale, "error.invalidJson"));
    }

    if (!parsed.success || !parsed.gentab) {
      throw new Error(parsed.error || translate(uiLocale, "error.generationFailed"));
    }

    const gentab = normalizeGentab(parsed.gentab, {
      sourceTabIds: referenceTabIds,
      userIntent,
      preferredType,
      contextPackage,
    });

    return {
      ok: true,
      contextPackage,
      executionPlan: plan,
      response: {
        ...response,
        gentab,
      },
      gentab,
      receipt: buildCompletedTurnReceipt({
        plan,
        contextPackage,
        response,
        uiLocale,
        gentabTitle: gentab?.title,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      contextPackage,
      executionPlan: plan,
      error,
      receipt: buildFailedTurnReceipt({
        plan,
        contextPackage,
        error,
        uiLocale,
        executionAttempted: true,
      }),
    };
  }
}
