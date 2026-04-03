import { execOpenClawJson } from "./OpenClawClient.mjs";
import {
  extractSkillTraceFromSession,
  parseSkillReceipt,
  buildSkillTrace,
  hasFailedSkillToolTrace,
  hasSuccessfulSkillToolTrace,
} from "./SkillTraceService.mjs";
import { buildBrowserSkillPrompt } from "./BrowserSkillPromptService.mjs";
import { resolveBrowserSkillInputPlan } from "./BrowserSkillInputPolicyService.mjs";

function createSkillRequestId() {
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function resolveAgentId(params, deps) {
  if (typeof params?.agentId === "string" && params.agentId.trim()) {
    return params.agentId.trim();
  }

  return deps.resolveDefaultAgentId();
}

export async function runLocalAgentTurn(params, deps) {
  const agentId = await resolveAgentId(params, deps);
  const message = typeof params?.message === "string" ? params.message.trim() : "";
  const thinking =
    typeof params?.thinking === "string" && params.thinking.trim()
      ? params.thinking.trim()
      : "low";
  const sessionId =
    typeof params?.sessionId === "string" && params.sessionId.trim()
      ? params.sessionId.trim()
      : "";

  if (!message) {
    throw new Error("消息不能为空");
  }

  const command = ["agent", "--agent", agentId];
  if (sessionId) {
    command.push("--session-id", sessionId);
  }
  command.push("--message", message, "--thinking", thinking, "--json");

  const payload = await execOpenClawJson(command, {
    timeout: 1000 * 60 * 5,
    maxBuffer: 1024 * 1024 * 2,
  });
  const result = payload?.result ?? {};
  const text = (Array.isArray(result.payloads) ? result.payloads : [])
    .map((entry) => (typeof entry?.text === "string" ? entry.text.trim() : ""))
    .filter(Boolean)
    .join("\n\n");

  return {
    agentId,
    text: text || "OpenClaw 没有返回文本内容。",
    sessionId: result?.meta?.agentMeta?.sessionId ?? null,
    model: result?.meta?.agentMeta?.model ?? null,
    provider: result?.meta?.agentMeta?.provider ?? null,
    durationMs: result?.meta?.durationMs ?? null,
  };
}

export async function runLocalSkillTurn(params, deps) {
  const requestedAt = new Date().toISOString();
  const requestId = createSkillRequestId();
  const baseSessionId =
    typeof params?.sessionId === "string" && params.sessionId.trim()
      ? params.sessionId.trim()
      : "";
  const skillSessionId = baseSessionId
    ? `${baseSessionId}__skill__${requestId}`
    : `skill-${requestId}`;
  const skill = await deps.getLocalSkillDetail(params?.skillName);

  if (!skill.ready) {
    const blockReason = skill.blockedByAllowlist
      ? "当前 skill 被 OpenClaw allowlist 限制。"
      : "";
    const message =
      skill.missingSummary
        ? `OpenClaw skill ${skill.name} 当前不可直接使用：${skill.missingSummary}`
        : `OpenClaw skill ${skill.name} 当前不可直接使用。${blockReason}`;
    const error = new Error(message);
    error.skillTrace = buildSkillTrace({
      requestId,
      skillName: skill.name,
      status: "failed",
      failureReason: message,
      steps: [
        {
          type: "request",
          title: `请求技能 ${skill.name}`,
          at: requestedAt,
        },
        {
          type: "final",
          title: "技能当前不可用",
          detail: message,
          isError: true,
        },
      ],
    });
    throw error;
  }

  const contextPackage = params?.contextPackage ?? {
    primary: params?.context ?? {
      title: "当前页面",
      url: "",
      selectedText: "",
      leadText: "",
      contentPreview: "",
      contentText: "",
    },
    references: Array.isArray(params?.attachments) ? params.attachments : [],
  };
  const context = contextPackage.primary ?? {
    title: "当前页面",
    url: "",
    selectedText: "",
    leadText: "",
    contentPreview: "",
    contentText: "",
  };
  const inputPlan = resolveBrowserSkillInputPlan({
    skill,
    context: contextPackage,
  });
  if (!inputPlan.canExecute) {
    const message =
      inputPlan.failureReason ||
      `OpenClaw skill ${skill.name} 当前没有可直接执行的输入材料。`;
    const error = new Error(message);
    error.skillTrace = buildSkillTrace({
      requestId,
      skillName: skill.name,
      status: "failed",
      failureReason: message,
      steps: [
        {
          type: "request",
          title: `请求技能 ${skill.name}`,
          at: requestedAt,
        },
        {
          type: "final",
          title: "技能输入当前不适配",
          detail: message,
          isError: true,
        },
      ],
    });
    throw error;
  }
  const message = buildBrowserSkillPrompt({
    action: `${params?.action ?? "ask"}`.trim(),
    prompt: `${params?.prompt ?? ""}`.trim(),
    contextPackage,
    skill,
    inputPlan,
    requestId,
  });

  const response = await runLocalAgentTurn(
    {
      agentId: params?.agentId,
      sessionId: skillSessionId,
      thinking: params?.thinking || "low",
      message,
    },
    deps,
  );

  const skillTraceBase = {
    agentId: response.agentId,
    sessionId: response.sessionId || skillSessionId,
    requestId,
    skillName: skill.name,
    requestAt: requestedAt,
    responseText: response.text,
  };
  const receipt = parseSkillReceipt(response.text, skill.name, requestId, true);
  if (!receipt.ok) {
    const optimisticSkillTrace = await extractSkillTraceFromSession({
      ...skillTraceBase,
      status: "used",
    });
    if (
      receipt.receiptType !== "failure" &&
      hasSuccessfulSkillToolTrace(optimisticSkillTrace) &&
      `${response.text ?? ""}`.trim()
    ) {
      return {
        ...response,
        sessionId: response.sessionId || skillSessionId,
        text: `${response.text}`.trim(),
        skill,
        skillTrace: optimisticSkillTrace,
      };
    }

    const failureReason =
      receipt.receiptType === "failure"
        ? `OpenClaw skill ${skill.name} 执行失败：${receipt.reason}`
        : `OpenClaw skill ${skill.name} 没有确认执行成功：${receipt.reason}`;
    const error = new Error(failureReason);
    error.skillTrace = await extractSkillTraceFromSession({
      ...skillTraceBase,
      status: "failed",
      failureReason,
    });
    throw error;
  }

  const skillTrace = await extractSkillTraceFromSession({
    ...skillTraceBase,
    status: "used",
  });

  if (
    hasFailedSkillToolTrace(skillTrace) &&
    !hasSuccessfulSkillToolTrace(skillTrace)
  ) {
    const failureReason =
      `OpenClaw skill ${skill.name} 返回了成功回执，但底层 tool 执行失败。`;
    const error = new Error(failureReason);
    error.skillTrace = await extractSkillTraceFromSession({
      ...skillTraceBase,
      status: "failed",
      failureReason,
    });
    throw error;
  }

  return {
    ...response,
    text: receipt.text || "OpenClaw 没有返回文本内容。",
    skill,
    skillTrace,
  };
}
