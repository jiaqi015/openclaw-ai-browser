import { runBrowserAgent, runRemoteHandsMode } from "../browser/BrowserAgentService.mjs";
import { getActiveTabId, getTabWebContentsById } from "../browser/TabManager.mjs";
import { getContextSnapshotForTab } from "../browser/TabContextService.mjs";
import { runRemoteBrainLoop } from "../openclaw/OpenClawBrainService.mjs";
import {
  getOpenClawRemoteDriver,
  getOpenClawTransportContext,
} from "../openclaw/OpenClawTransportContext.mjs";
import { createRelayMessenger } from "../openclaw/relay/SabrinaRelayRpcService.mjs";
import { archiveSession, recordRuntimeEvent } from "../shared/SabrinaLoggerService.mjs";
import { appendMessageToThread } from "../threads/ThreadStore.mjs";
import { buildTurnJournalEntry } from "./TurnJournalService.mjs";
import { recordTurnJournalEntry } from "./TurnJournalStore.mjs";
import { executeBrowserAgentTurn } from "./TurnEngine.mjs";

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function buildAgentSkillTrace(task, agentResult) {
  const journal = Array.isArray(agentResult?.journal) ? agentResult.journal : [];
  return {
    skillName: "browser-agent",
    status: agentResult?.ok ? "completed" : "failed",
    steps: journal.map((entry) => ({
      type: entry?.type === "done" ? "final" : "info",
      title: entry?.action?.action || entry?.type || "agent-step",
      detail:
        entry?.reasoning ||
        entry?.message ||
        entry?.result?.error ||
        entry?.error ||
        "",
      screenshot: entry?.screenshot,
      isError:
        entry?.type === "error" ||
        entry?.type === "verify-fail" ||
        entry?.result?.ok === false,
    })),
  };
}

async function appendAgentResultMessage(task, turnResult, agentResult) {
  if (!task.threadId) {
    return;
  }

  const fallbackText = agentResult?.ok
    ? agentResult?.summary || "Agent task completed."
    : `Agent task failed: ${agentResult?.error || "Unknown error"}`;

  await appendMessageToThread({
    threadId: task.threadId,
    message: {
      role: agentResult?.ok ? "assistant" : "error",
      text: turnResult?.receipt?.userVisibleMessage || fallbackText,
      skillTrace: buildAgentSkillTrace(task, agentResult),
    },
  });
}

async function appendAgentTurnJournal(task, turnResult) {
  const journalEntry = buildTurnJournalEntry({
    threadId: task.threadId,
    userText: task.userTask,
    plan: turnResult?.executionPlan,
    receipt: turnResult?.receipt,
    contextPackage: turnResult?.contextPackage,
    response: turnResult?.response,
    error: turnResult?.error,
  });
  return recordTurnJournalEntry(journalEntry);
}

async function runBrowserAgentTaskExecution(task, dependencies, sendProgress, requestConfirm) {
  const transportContext = getOpenClawTransportContext();
  const driver = getOpenClawRemoteDriver(transportContext);

  if (driver === "relay-paired") {
    const messenger = await createRelayMessenger({
      relayUrl: transportContext.relayUrl,
      connectCode: transportContext.connectCode,
    });

    const handsPromise = runRemoteHandsMode(
      {
        messenger,
        getWebContentsByTabId: (id) => getTabWebContentsById(id),
        getActiveTabId,
        signal: task.abortController.signal,
      },
      dependencies,
    );

    try {
      return await runRemoteBrainLoop(
        {
          messenger,
          tabId: task.tabId,
          task: task.userTask,
          userData: task.userData,
          sendProgress,
          requestConfirm,
          signal: task.abortController.signal,
        },
        dependencies,
      );
    } finally {
      messenger.close();
      task.abortController.abort();
      await handsPromise.catch(() => {});
    }
  }

  return runBrowserAgent(
    {
      tabId: task.tabId,
      task: task.userTask,
      userData: task.userData,
      sendProgress,
      requestConfirm,
      signal: task.abortController.signal,
      sessionId: task.sessionId,
    },
    {
      runLocalAgentTurn: dependencies.runLocalAgentTurn,
      getWebContentsByTabId: (id) => getTabWebContentsById(id),
      getActiveTabId,
    },
  );
}

/** @type {Map<string, object>} */
const activeTasks = new Map();
/** @type {Map<string, string>} */
const tabToTask = new Map();

export function createAgentTask(params) {
  const { tabId, task, userData, threadId } = params;

  const existingTaskId = tabToTask.get(tabId);
  if (existingTaskId) {
    const existingTask = activeTasks.get(existingTaskId);
    if (existingTask && (existingTask.status === "running" || existingTask.status === "paused")) {
      throw new Error("该标签页已有正在执行的 Agent 任务");
    }
  }

  const taskId = `agent-task-${Math.random().toString(36).slice(2, 10)}`;
  const sessionId = `agent-session-${taskId}`;
  const abortController = new AbortController();

  const taskObj = {
    taskId,
    sessionId,
    tabId,
    threadId,
    status: "idle",
    userTask: task,
    userData,
    journal: [],
    warnings: [],
    currentStep: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    abortController,
    pendingConfirm: null,
    executionPlan: null,
    contextPackage: null,
    receipt: null,
  };

  activeTasks.set(taskId, taskObj);
  tabToTask.set(tabId, taskId);

  return taskId;
}

export async function startAgentTask(taskId, dependencies = {}) {
  const task = activeTasks.get(taskId);
  if (!task) throw new Error("任务不存在");

  task.status = "running";
  task.updatedAt = Date.now();

  const sendProgress = (data) => {
    task.currentStep = data.step || task.currentStep;
    task.updatedAt = Date.now();
    dependencies.onProgress?.(taskId, data);
  };

  const requestConfirm = (data) => {
    task.status = "paused";
    task.pendingConfirm = data;
    task.updatedAt = Date.now();

    return new Promise((resolve) => {
      task.resolveConfirm = (confirmed) => {
        task.status = "running";
        task.pendingConfirm = null;
        task.updatedAt = Date.now();
        resolve(confirmed);
      };
      dependencies.onRequestConfirm?.(taskId, data);
    });
  };

  let agentResult = null;
  let turnResult = null;

  try {
    turnResult = await executeBrowserAgentTurn(
      {
        threadId: task.threadId,
        userText: task.userTask,
        agentPayload: {
          tabId: task.tabId,
          task: task.userTask,
          taskId: task.taskId,
        },
      },
      {
        getContextSnapshotForTab:
          typeof dependencies.getContextSnapshotForTab === "function"
            ? dependencies.getContextSnapshotForTab
            : getContextSnapshotForTab,
        runBrowserAgentTask: () =>
          runBrowserAgentTaskExecution(task, dependencies, sendProgress, requestConfirm),
      },
    );

    agentResult = turnResult?.agentResult ?? {
      ok: turnResult?.ok === true,
      journal: [],
      warnings: [],
      summary: turnResult?.response?.message || "",
      error: turnResult?.error ? getErrorMessage(turnResult.error) : "",
    };
  } catch (error) {
    agentResult = {
      ok: false,
      journal: [],
      warnings: [],
      summary: "",
      error: getErrorMessage(error),
    };
    turnResult = {
      ok: false,
      agentResult,
      contextPackage: null,
      executionPlan: null,
      response: null,
      error,
      receipt: null,
    };
  }

  task.executionPlan = turnResult?.executionPlan ?? null;
  task.contextPackage = turnResult?.contextPackage ?? null;
  task.receipt = turnResult?.receipt ?? null;
  task.journal = Array.isArray(agentResult?.journal) ? agentResult.journal : [];
  task.warnings = Array.isArray(agentResult?.warnings) ? agentResult.warnings : [];

  if (agentResult?.ok) {
    task.status = "completed";
    task.summary = agentResult.summary;
  } else {
    task.status = task.abortController.signal.aborted ? "cancelled" : "error";
    task.error = agentResult?.error;
  }

  if (turnResult?.executionPlan || turnResult?.receipt || turnResult?.error) {
    await appendAgentTurnJournal(task, turnResult).catch((error) => {
      console.error("[BrowserAgentTaskService] Failed to append turn journal:", error);
    });
  }
  await appendAgentResultMessage(task, turnResult, agentResult).catch((error) => {
    console.error("[BrowserAgentTaskService] Failed to append thread message:", error);
  });

  task.updatedAt = Date.now();

  archiveSession(taskId, {
    status: task.status,
    userTask: task.userTask,
    threadId: task.threadId,
    journal: task.journal,
    warnings: task.warnings,
    summary: task.summary,
    error: task.error,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  }).catch((error) => console.error("[BrowserAgentTaskService] Archive failed:", error));

  dependencies.onTaskEnd?.(taskId, task);
  recordRuntimeEvent("agent.task_ended", {
    taskId,
    status: task.status,
    warningCount: task.warnings?.length || 0,
  });
}

export function respondToConfirm(taskId, confirmed) {
  const task = activeTasks.get(taskId);
  if (task && task.resolveConfirm) {
    task.resolveConfirm(confirmed);
    delete task.resolveConfirm;
  }
}

export function cancelAgentTask(taskId) {
  const task = activeTasks.get(taskId);
  if (task) {
    task.abortController.abort();
    if (task.resolveConfirm) {
      task.resolveConfirm(false);
    }
  }
}

export function getAgentTask(taskId) {
  return activeTasks.get(taskId);
}

export function getActiveTaskForTab(tabId) {
  const taskId = tabToTask.get(tabId);
  return taskId ? activeTasks.get(taskId) : null;
}
