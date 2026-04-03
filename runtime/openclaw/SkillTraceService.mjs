import fs from "node:fs/promises";
import path from "node:path";
import { resolveOpenClawStateDir } from "./OpenClawConfigCache.mjs";

function truncateSkillTraceDetail(value, max = 220) {
  const normalized = `${value ?? ""}`.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}

function getMessageTextContent(message) {
  const content = Array.isArray(message?.content) ? message.content : [];
  return content
    .map((entry) => (entry?.type === "text" && typeof entry?.text === "string" ? entry.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function getFirstToolCallContent(message) {
  const content = Array.isArray(message?.content) ? message.content : [];
  return (
    content.find(
      (entry) =>
        entry?.type === "toolCall" &&
        typeof entry?.name === "string" &&
        entry.name.trim(),
    ) ?? null
  );
}

function findPreviousUserMessageIndex(events, fromIndex) {
  for (let index = Math.min(fromIndex, events.length - 1); index >= 0; index -= 1) {
    if (events[index]?.message?.role === "user") {
      return index;
    }
  }

  return -1;
}

function findNextUserMessageIndex(events, fromIndex) {
  for (let index = Math.max(fromIndex, 0); index < events.length; index += 1) {
    if (events[index]?.message?.role === "user") {
      return index;
    }
  }

  return events.length;
}

function findLastAssistantIndex(events, startIndex, endIndex) {
  for (let index = Math.min(endIndex, events.length) - 1; index >= startIndex; index -= 1) {
    if (events[index]?.message?.role === "assistant") {
      return index;
    }
  }

  return -1;
}

function findLastAssistantReceiptIndex(events, params) {
  const startIndex = Math.max(params?.startIndex ?? 0, 0);
  const endIndex = Math.min(params?.endIndex ?? events.length, events.length);

  for (let index = endIndex - 1; index >= startIndex; index -= 1) {
    const message = events[index]?.message;
    if (!message || message.role !== "assistant") {
      continue;
    }

    const text = getMessageTextContent(message);
    const receipt = parseSkillReceipt(
      text,
      params?.skillName,
      params?.requestId,
      params?.allowLegacy !== false,
    );
    if (receipt.matchedTag) {
      return index;
    }
  }

  return -1;
}

function findSkillRequestStartIndex(events, params) {
  const requestId = `${params?.requestId ?? ""}`.trim();
  const skillName = `${params?.skillName ?? ""}`.trim();

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const message = events[index]?.message;
    if (!message || message.role !== "user") {
      continue;
    }

    const text = getMessageTextContent(message);
    if (requestId && text.includes(requestId)) {
      return index;
    }

    if (!requestId && skillName && (text.includes(`OpenClaw skill "${skillName}"`) || text.includes(`/${skillName}`))) {
      return index;
    }
  }

  return -1;
}

function resolveSkillTraceWindow(events, params) {
  const requestStartIndex = findSkillRequestStartIndex(events, params);
  if (requestStartIndex >= 0) {
    const endIndex = findNextUserMessageIndex(events, requestStartIndex + 1);
    const receiptIndex = findLastAssistantReceiptIndex(events, {
        ...params,
        startIndex: requestStartIndex + 1,
        endIndex,
      });
    const finalIndex =
      receiptIndex >= 0
        ? receiptIndex
        : findLastAssistantIndex(events, requestStartIndex + 1, endIndex);

    return {
      startIndex: requestStartIndex + 1,
      endIndex,
      finalIndex: finalIndex >= 0 ? finalIndex : -1,
    };
  }

  const receiptIndex = findLastAssistantReceiptIndex(events, params);
  if (receiptIndex >= 0) {
    const startIndex = findPreviousUserMessageIndex(events, receiptIndex) + 1;
    return {
      startIndex: Math.max(startIndex, 0),
      endIndex: receiptIndex + 1,
      finalIndex: receiptIndex,
    };
  }

  return {
    startIndex: events.length,
    endIndex: events.length,
    finalIndex: -1,
  };
}

function parseSkillReceipt(responseText, skillName, requestId = "", allowLegacy = true) {
  const normalizedSkillName = `${skillName ?? ""}`.trim();
  const normalizedRequestId = `${requestId ?? ""}`.trim();
  const successTags = [];
  const failedPrefixes = [];

  if (normalizedSkillName && normalizedRequestId) {
    successTags.push(`[SKILL_USED:${normalizedSkillName}:${normalizedRequestId}]`);
    failedPrefixes.push(`[SKILL_FAILED:${normalizedSkillName}:${normalizedRequestId}]`);
  }

  if (normalizedSkillName && (allowLegacy || !normalizedRequestId)) {
    successTags.push(`[SKILL_USED:${normalizedSkillName}]`);
    failedPrefixes.push(`[SKILL_FAILED:${normalizedSkillName}]`);
  }

  const rawText = `${responseText ?? ""}`.trim();
  const lines = rawText.split(/\r?\n/);
  const firstLine = `${lines[0] ?? ""}`.trim();

  for (const successTag of successTags) {
    if (firstLine === successTag) {
      return {
        ok: true,
        receiptType: "success",
        text: lines.slice(1).join("\n").trim(),
        matchedTag: successTag,
      };
    }
  }

  for (const failedPrefix of failedPrefixes) {
    if (firstLine.startsWith(failedPrefix)) {
      const reason = firstLine.slice(failedPrefix.length).trim();
      return {
        ok: false,
        receiptType: "failure",
        reason: reason || "OpenClaw 返回了 skill 失败回执。",
        matchedTag: failedPrefix,
      };
    }
  }

  const expectedTag = successTags[0] || `[SKILL_USED:${normalizedSkillName}]`;
  return {
    ok: false,
    receiptType: "missing",
    reason: `OpenClaw 未返回技能回执 ${expectedTag}.`,
  };
}

function buildOptimisticSkillSuccessDetail(params) {
  const responseText = `${params?.responseText ?? ""}`.trim();
  if (responseText) {
    return responseText;
  }

  const toolResultDetail = `${params?.toolResultDetail ?? ""}`.trim();
  if (toolResultDetail) {
    return toolResultDetail;
  }

  return "OpenClaw 未附带显式回执，已根据成功工具结果确认技能执行。";
}

function buildSkillTrace(params) {
  return {
    runId:
      `${params?.requestId ?? ""}`.trim() ||
      `${params?.sessionId || params?.skillName || "skill"}:${Date.now()}`,
    requestId: `${params?.requestId ?? ""}`.trim() || undefined,
    skillName: `${params?.skillName ?? ""}`.trim(),
    status: params?.status || "requested",
    failureReason: params?.failureReason || undefined,
    steps: Array.isArray(params?.steps) ? params.steps.filter(Boolean) : [],
  };
}

function buildSkillFinalTraceStep(params) {
  const receipt = parseSkillReceipt(
    params?.responseText,
    params?.skillName,
    params?.requestId,
    true,
  );
  const status = params?.status || "requested";
  const failedByToolTrace =
    params?.hasFailedToolTrace === true &&
    params?.hasSuccessfulToolTrace !== true;
  const failedByReceipt = receipt.receiptType === "failure";
  const usedByOptimisticTrace =
    status === "used" &&
    failedByToolTrace !== true &&
    failedByReceipt !== true &&
    receipt.ok !== true &&
    params?.hasSuccessfulToolTrace === true;
  const usedByReceipt = receipt.ok === true && failedByToolTrace !== true;
  const failureDetail =
    failedByReceipt && receipt.reason
      ? receipt.reason
      : `${params?.failureReason || params?.toolResultDetail || receipt.reason || ""}`.trim();

  const bodyText = usedByReceipt
    ? receipt.text
    : usedByOptimisticTrace
      ? buildOptimisticSkillSuccessDetail(params)
      : failureDetail;

  return {
    type: "final",
    title:
      usedByReceipt
        ? "已收到技能成功回执"
        : usedByOptimisticTrace
          ? "已确认技能执行成功"
        : status === "fallback"
          ? "已回退为普通对话"
          : "技能执行未成功",
    detail: truncateSkillTraceDetail(bodyText),
    at: params?.at || undefined,
    isError: !(usedByReceipt || usedByOptimisticTrace),
  };
}

function hasSuccessfulSkillToolTrace(trace) {
  const steps = Array.isArray(trace?.steps) ? trace.steps : [];
  return steps.some(
    (step) =>
      step?.type === "tool_result" &&
        Number(step?.exitCode) === 0 &&
        step?.isError !== true,
  );
}

function hasFailedSkillToolTrace(trace) {
  const steps = Array.isArray(trace?.steps) ? trace.steps : [];
  return steps.some(
    (step) =>
      step?.type === "tool_result" &&
      (step?.isError === true || Number(step?.exitCode) > 0),
  );
}

export async function extractSkillTraceFromSession(params) {
  const skillName = `${params?.skillName ?? ""}`.trim();
  const agentId = `${params?.agentId ?? ""}`.trim();
  const sessionId = `${params?.sessionId ?? ""}`.trim();
  const requestId = `${params?.requestId ?? ""}`.trim();
  const status = params?.status || "requested";
  const requestAt = params?.requestAt || new Date().toISOString();
  const steps = [
    {
      type: "request",
      title: `请求技能 ${skillName}`,
      at: requestAt,
    },
  ];

  if (!agentId || !sessionId) {
    steps.push(
      buildSkillFinalTraceStep({
        skillName,
        requestId,
        status,
        failureReason: params?.failureReason,
        responseText: params?.responseText,
      }),
    );
    return buildSkillTrace({
      skillName,
      requestId,
      sessionId,
      status,
      failureReason: params?.failureReason,
      steps,
    });
  }

  const stateDir = resolveOpenClawStateDir();
  const logPath = path.join(
    stateDir,
    "agents",
    agentId,
    "sessions",
    `${sessionId}.jsonl`,
  );

  let events = [];
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const raw = await fs.readFile(logPath, "utf8");
      events = raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      break;
    } catch (error) {
      if (attempt === 3) break;
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }

  const traceWindow = resolveSkillTraceWindow(events, {
    skillName,
    requestId,
    allowLegacy: !requestId,
  });

  let toolResultEvent = null;
  let toolCallItem = null;

  for (let index = traceWindow.finalIndex; index >= traceWindow.startIndex; index -= 1) {
    const message = events[index]?.message;
    if (!message) continue;

    if (!toolResultEvent && message.role === "toolResult") {
      toolResultEvent = message;
      continue;
    }

    if (!toolCallItem && message.role === "assistant") {
      toolCallItem = getFirstToolCallContent(message);
    }

    if (toolResultEvent && toolCallItem) break;
  }

  if (toolCallItem) {
    const toolArguments =
      typeof toolCallItem?.arguments?.command === "string"
        ? toolCallItem.arguments.command
        : JSON.stringify(toolCallItem?.arguments ?? {});

    steps.push({
      type: "tool_call",
      title: `tool: ${toolCallItem.name}`,
      detail: truncateSkillTraceDetail(toolArguments),
    });
  }

  if (toolResultEvent) {
    const detail =
      toolResultEvent?.details?.aggregated ||
        (Array.isArray(toolResultEvent?.content)
          ? toolResultEvent.content
              .map((entry) => typeof entry?.text === "string" ? entry.text : "")
              .filter(Boolean)
              .join("\n")
          : "");
    const exitCode = Number.isFinite(toolResultEvent?.details?.exitCode)
      ? toolResultEvent.details.exitCode
      : undefined;
    const durationMs = Number.isFinite(toolResultEvent?.details?.durationMs)
      ? toolResultEvent.details.durationMs
      : undefined;

    steps.push({
      type: "tool_result",
      title: `结果 ${toolResultEvent.toolName || "tool"}`,
      detail: truncateSkillTraceDetail(detail),
      exitCode,
      durationMs,
      isError: Boolean(toolResultEvent?.isError) || Number(exitCode) > 0,
    });
  }

  const toolResultDetail =
    steps.findLast?.((step) => step?.type === "tool_result")?.detail ||
    [...steps].reverse().find((step) => step?.type === "tool_result")?.detail ||
    "";
  const hasSuccessfulToolTrace = hasSuccessfulSkillToolTrace({ steps });
  const hasFailedToolTrace = hasFailedSkillToolTrace({ steps });

  steps.push(
    buildSkillFinalTraceStep({
      skillName,
      requestId,
      status,
      failureReason: params?.failureReason,
      responseText: params?.responseText,
      hasSuccessfulToolTrace,
      hasFailedToolTrace,
      toolResultDetail,
    }),
  );

  return buildSkillTrace({
    skillName,
    requestId,
    sessionId,
    status,
    failureReason: params?.failureReason,
    steps,
  });
}

export {
  truncateSkillTraceDetail,
  parseSkillReceipt,
  buildSkillTrace,
  buildSkillFinalTraceStep,
  hasSuccessfulSkillToolTrace,
  hasFailedSkillToolTrace,
};
