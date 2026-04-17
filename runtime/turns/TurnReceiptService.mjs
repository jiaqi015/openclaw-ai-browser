import { translate } from "../../shared/localization.mjs";

function normalizeNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function getPlanEvidence(plan, contextPackage, executionAttempted) {
  return {
    executionAttempted: Boolean(executionAttempted),
    routeKind: normalizeNonEmptyString(contextPackage?.execution?.primarySourceKind),
    trustLevel: normalizeNonEmptyString(contextPackage?.execution?.trustLevel),
    honestyConstraintsApplied:
      plan?.executionContract?.honestyMode === "explicit-failure-required",
    requiredEvidence: Array.isArray(plan?.executionContract?.requiredEvidence)
      ? [...plan.executionContract.requiredEvidence]
      : [],
  };
}

function getTraceSkillName(plan, fallbackSkillName = "") {
  if (plan?.strategy === "browser_agent_task") {
    return "browser-agent";
  }

  return normalizeNonEmptyString(plan?.skillPolicy?.name) || normalizeNonEmptyString(fallbackSkillName) || undefined;
}

function buildAiAssistantText(response, requestedSkillName, uiLocale) {
  const finalMessage = `${response?.message || translate(uiLocale, "turn.modelNoVisibleText")}`.trim();
  if (!response?.skillFallback) {
    return finalMessage;
  }

  return [
    translate(uiLocale, "turn.skillFallbackNotice", {
      skillName: response.skillName || requestedSkillName || "skill",
    }),
    response.skillFailureReason
      ? translate(uiLocale, "turn.reasonPrefix", {
          reason: response.skillFailureReason,
        })
      : "",
    "",
    finalMessage,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildOpenClawAssistantText(response, taskTitle, uiLocale, contextPackage) {
  const isPureOpenClaw =
    normalizeNonEmptyString(contextPackage?.execution?.primarySourceKind) ===
    "pure-openclaw";

  return [
    translate(uiLocale, "turn.openclawHandoffTitle"),
    translate(uiLocale, "turn.openclawHandoffMode"),
    isPureOpenClaw
      ? ""
      : translate(uiLocale, "turn.openclawHandoffPage", {
          title:
            normalizeNonEmptyString(taskTitle) ||
            translate(uiLocale, "common.currentPage"),
        }),
    "",
    `${response?.text || translate(uiLocale, "turn.openclawNoVisibleText")}`.trim(),
  ].join("\n");
}

function buildBrowserAgentAssistantText(response, uiLocale) {
  return [
    translate(uiLocale, "turn.agentCompletedTitle"),
    translate(uiLocale, "turn.agentExecutionMode"),
    "",
    `${response?.message || translate(uiLocale, "turn.agentNoVisibleText")}`.trim(),
  ].join("\n");
}

function buildGenTabAssistantText(gentabTitle, uiLocale) {
  return [
    translate(uiLocale, "turn.gentabGeneratedTitle"),
    translate(uiLocale, "turn.gentabWorkbench", {
      title: normalizeNonEmptyString(gentabTitle) || "GenTab",
    }),
    translate(uiLocale, "turn.gentabMode"),
  ].join("\n");
}

export function buildCompletedTurnReceipt({
  plan,
  contextPackage,
  response,
  requestedSkillName = "",
  taskTitle = "",
  gentabTitle = "",
  uiLocale = "zh-CN",
} = {}) {
  if (plan?.strategy === "background_task") {
    return {
      status: "completed",
      strategy: plan.strategy,
      summary: translate(uiLocale, "turn.summary.background"),
      userVisibleMessage: buildOpenClawAssistantText(
        response,
        taskTitle,
        uiLocale,
        contextPackage,
      ),
      trace: {
        model: response?.model || undefined,
        skillName: undefined,
        taskId: response?.taskId || undefined,
      },
      contract: plan?.executionContract || null,
      evidence: getPlanEvidence(plan, contextPackage, true),
    };
  }

  if (plan?.strategy === "browser_agent_task") {
    return {
      status: "completed",
      strategy: plan.strategy,
      summary: translate(uiLocale, "turn.summary.agent"),
      userVisibleMessage: buildBrowserAgentAssistantText(response, uiLocale),
      trace: {
        model: response?.model || undefined,
        skillName: "browser-agent",
        taskId: response?.taskId || undefined,
      },
      contract: plan?.executionContract || null,
      evidence: getPlanEvidence(plan, contextPackage, true),
    };
  }

  if (plan?.strategy === "artifact_generation") {
    return {
      status: "completed",
      strategy: plan.strategy,
      summary: translate(uiLocale, "turn.summary.gentab"),
      userVisibleMessage: buildGenTabAssistantText(gentabTitle, uiLocale),
      trace: {
        model: response?.model || undefined,
        skillName: undefined,
        taskId: undefined,
      },
      contract: plan?.executionContract || null,
      evidence: getPlanEvidence(plan, contextPackage, true),
    };
  }

  return {
    status: "completed",
    strategy: plan?.strategy || "chat_response",
    summary:
      plan?.strategy === "strict_skill_execution"
        ? translate(uiLocale, "turn.summary.skillDone", {
            skillName: requestedSkillName || response?.skillName || "skill",
          })
        : translate(uiLocale, "turn.summary.askDone"),
    userVisibleMessage: buildAiAssistantText(response, requestedSkillName, uiLocale),
    trace: {
      model: response?.model || undefined,
      skillName: getTraceSkillName(plan, requestedSkillName || response?.skillName),
      taskId: undefined,
    },
    contract: plan?.executionContract || null,
    evidence: getPlanEvidence(plan, contextPackage, true),
  };
}

export function buildFailedTurnReceipt({
  plan,
  contextPackage,
  error,
  executionAttempted = false,
  uiLocale = "zh-CN",
} = {}) {
  const message = error instanceof Error ? error.message : String(error);

  return {
    status: "failed",
    strategy: plan?.strategy || "chat_response",
    summary: translate(uiLocale, "turn.summary.failed"),
    userVisibleMessage: message,
    trace: {
      model: undefined,
      skillName: getTraceSkillName(plan),
      taskId: undefined,
    },
    contract: plan?.executionContract || null,
    evidence: getPlanEvidence(plan, contextPackage, executionAttempted),
  };
}

export function buildBlockedTurnReceipt({
  plan,
  contextPackage,
  message,
  uiLocale = "zh-CN",
} = {}) {
  const normalizedMessage =
    normalizeNonEmptyString(message) || translate(uiLocale, "turn.blockedDefault");

  return {
    status: "blocked",
    strategy: plan?.strategy || "chat_response",
    summary: translate(uiLocale, "turn.summary.blocked"),
    userVisibleMessage: normalizedMessage,
    trace: {
      model: undefined,
      skillName: getTraceSkillName(plan),
      taskId: undefined,
    },
    contract: plan?.executionContract || null,
    evidence: getPlanEvidence(plan, contextPackage, false),
  };
}
