function normalizeNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function getPlanEvidence(plan, contextPackage, executionAttempted) {
  return {
    executionAttempted: Boolean(executionAttempted),
    routeKind: normalizeNonEmptyString(contextPackage?.execution?.primarySourceKind),
    sourceKind: normalizeNonEmptyString(contextPackage?.execution?.trustLevel),
    honestyConstraintsApplied:
      plan?.policyDecision === "allow-with-honesty-constraints",
  };
}

function buildAiAssistantText(response, requestedSkillName) {
  const finalMessage = `${response?.message || "模型没有返回可显示的文本。"}`.trim();
  if (!response?.skillFallback) {
    return finalMessage;
  }

  return [
    `提示：技能 ${response.skillName || requestedSkillName || "请求技能"} 当前不可用，本次已切换为普通对话。`,
    response.skillFailureReason ? `原因：${response.skillFailureReason}` : "",
    "",
    finalMessage,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildOpenClawAssistantText(response, taskTitle) {
  return [
    "### 已交给龙虾异步处理",
    `- 处理方式：**龙虾异步处理**`,
    `- 当前页面：**${normalizeNonEmptyString(taskTitle) || "当前页面"}**`,
    "",
    `${response?.text || "龙虾没有返回可显示的文本。"}`.trim(),
  ].join("\n");
}

function buildGenTabAssistantText(gentabTitle) {
  return [
    "### GenTab 已生成",
    `- 工作台：**${normalizeNonEmptyString(gentabTitle) || "新的 GenTab 工作台"}**`,
    "- 处理方式：**结构化工作台生成**",
  ].join("\n");
}

export function buildCompletedTurnReceipt({
  plan,
  contextPackage,
  response,
  requestedSkillName = "",
  taskTitle = "",
  gentabTitle = "",
} = {}) {
  if (plan?.strategy === "background_task") {
    return {
      status: "completed",
      strategy: plan.strategy,
      summary: "已交给 OpenClaw 异步处理",
      userVisibleMessage: buildOpenClawAssistantText(response, taskTitle),
      trace: {
        model: response?.model || undefined,
        skillName: undefined,
        taskId: response?.taskId || undefined,
      },
      evidence: getPlanEvidence(plan, contextPackage, true),
    };
  }

  if (plan?.strategy === "artifact_generation") {
    return {
      status: "completed",
      strategy: plan.strategy,
      summary: "GenTab 已生成",
      userVisibleMessage: buildGenTabAssistantText(gentabTitle),
      trace: {
        model: response?.model || undefined,
        skillName: undefined,
        taskId: undefined,
      },
      evidence: getPlanEvidence(plan, contextPackage, true),
    };
  }

  return {
    status: "completed",
    strategy: plan?.strategy || "chat_response",
    summary:
      plan?.strategy === "strict_skill_execution"
        ? `技能 ${requestedSkillName || response?.skillName || "当前技能"} 已完成`
        : "浏览器问答已完成",
    userVisibleMessage: buildAiAssistantText(response, requestedSkillName),
    trace: {
      model: response?.model || undefined,
      skillName: requestedSkillName || response?.skillName || undefined,
      taskId: undefined,
    },
    evidence: getPlanEvidence(plan, contextPackage, true),
  };
}

export function buildFailedTurnReceipt({
  plan,
  contextPackage,
  error,
  executionAttempted = false,
} = {}) {
  const message = error instanceof Error ? error.message : String(error);

  return {
    status: "failed",
    strategy: plan?.strategy || "chat_response",
    summary: "浏览器 turn 执行失败",
    userVisibleMessage: message,
    trace: {
      model: undefined,
      skillName: plan?.skillPolicy?.name || undefined,
      taskId: undefined,
    },
    evidence: getPlanEvidence(plan, contextPackage, executionAttempted),
  };
}

export function buildBlockedTurnReceipt({
  plan,
  contextPackage,
  message,
} = {}) {
  const normalizedMessage = normalizeNonEmptyString(message) || "当前 turn 被策略阻止。";

  return {
    status: "blocked",
    strategy: plan?.strategy || "chat_response",
    summary: "浏览器 turn 被策略阻止",
    userVisibleMessage: normalizedMessage,
    trace: {
      model: undefined,
      skillName: plan?.skillPolicy?.name || undefined,
      taskId: undefined,
    },
    evidence: getPlanEvidence(plan, contextPackage, false),
  };
}
