/**
 * AgentTaskManager.mjs
 * 任务管理：生命周期、确认流、中断。
 */

import { runBrowserAgent, runRemoteHandsMode } from "./BrowserAgentService.mjs";
import { runRemoteBrainLoop } from "../openclaw/OpenClawBrainService.mjs";
import { getTabWebContentsById, getActiveTabId } from "./TabManager.mjs";
import { appendMessageToThread } from "../threads/ThreadStore.mjs";
import { getOpenClawTransportContext, getOpenClawRemoteDriver } from "../openclaw/OpenClawTransportContext.mjs";
import { archiveSession, recordRuntimeEvent } from "../shared/SabrinaLoggerService.mjs";
import { createRelayMessenger } from "../openclaw/relay/SabrinaRelayRpcService.mjs";

/** @type {Map<string, object>} */
const activeTasks = new Map(); // taskId -> task object
/** @type {Map<string, string>} */
const tabToTask = new Map(); // tabId -> taskId

export function createAgentTask(params) {
  const { tabId, task, userData, threadId } = params;
  
  // 一个标签页只能有一个活跃任务
  const existingTaskId = tabToTask.get(tabId);
  if (existingTaskId) {
    const existingTask = activeTasks.get(existingTaskId);
    if (existingTask && (existingTask.status === "running" || existingTask.status === "paused")) {
      throw new Error("该标签页已有正在执行的 Agent 任务");
    }
  }

  const taskId = `agent-task-${Math.random().toString(36).slice(2, 10)}`;
  // 每个任务有独立的 sessionId，传给 OpenClaw 实现跨步记忆
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
  };

  activeTasks.set(taskId, taskObj);
  tabToTask.set(tabId, taskId);

  return taskId;
}

export async function startAgentTask(taskId, dependencies) {
  const task = activeTasks.get(taskId);
  if (!task) throw new Error("任务不存在");

  const { runLocalAgentTurn } = dependencies;

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

  let result = null;
  const transportContext = getOpenClawTransportContext();
  const driver = getOpenClawRemoteDriver(transportContext);

  try {
    if (driver === "relay-paired") {
      // V8: Brain-Hands Split Mode (Decoupled Pattern)
      // 1. 创建通讯器 (Messenger)
      const messenger = await createRelayMessenger({
        relayUrl: transportContext.relayUrl,
        connectCode: transportContext.connectCode,
      });

      // 2. 启动两个并发过程：1. 被动执行终端 (Hands) 2. 远程大脑循环 (Brain)
      const handsPromise = runRemoteHandsMode({
        messenger,
        getWebContentsByTabId: (id) => getTabWebContentsById(id),
        getActiveTabId,
        signal: task.abortController.signal,
      }, dependencies);

      result = await runRemoteBrainLoop({
        messenger,
        tabId: task.tabId,
        task: task.userTask,
        userData: task.userData,
        sendProgress,
        requestConfirm,
        signal: task.abortController.signal,
      }, dependencies);

      // 任务结束，关闭通讯器并取消 Hands 监听
      messenger.close();
      task.abortController.abort();
      await handsPromise.catch(() => {});
    } else {
      // 传统模式：本地循环
      result = await runBrowserAgent(
        {
          tabId: task.tabId,
          task: task.userTask,
          userData: task.userData,
          sendProgress,
          requestConfirm,
          signal: task.abortController.signal,
          sessionId: task.sessionId, // 跨步骤持久记忆
        },
        {
          runLocalAgentTurn,
          getWebContentsByTabId: (id) => getTabWebContentsById(id),
          getActiveTabId,
        }
      );
    }

    if (result.ok) {
      task.status = "completed";
      task.summary = result.summary;
    } else {
      task.status = task.abortController.signal.aborted ? "cancelled" : "error";
      task.error = result.error;
    }
    task.journal = result.journal;
    task.warnings = Array.isArray(result.warnings) ? result.warnings : [];

    // Phase 7: 将执行结果持久化到 Thread 历史中 (透传视觉证据)
    if (task.threadId && result.journal.length > 0) {
      const messageText = result.ok 
        ? (result.summary || "Agent task completed.")
        : `Agent task failed: ${result.error || "Unknown error"}`;
      
      await appendMessageToThread({
        threadId: task.threadId,
        message: {
          role: "assistant",
          text: messageText,
          skillTrace: {
            skillName: "browser-agent",
            status: result.ok ? "completed" : "failed",
            steps: result.journal.map(j => ({
              type: j.type === "done" ? "final" : "info",
              title: j.action?.action || j.type,
              detail: j.reasoning || j.message || j.result?.error || "",
              screenshot: j.screenshot,
              isError:
                j.type === "error" ||
                j.type === "verify-fail" ||
                j.result?.ok === false
            }))
          }
        }
      });
    }
  } finally {
    task.updatedAt = Date.now();
    
    // 存档会话以供长期架构优化 (V8 Long-term iteration)
    archiveSession(taskId, {
      status: task.status,
      userTask: task.userTask,
      threadId: task.threadId,
      journal: task.journal,
      warnings: task.warnings,
      summary: task.summary,
      error: task.error,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    }).catch(err => console.error("[AgentTaskManager] Archive failed:", err));

    dependencies.onTaskEnd?.(taskId, task);
    recordRuntimeEvent("agent.task_ended", {
      taskId,
      status: task.status,
      warningCount: task.warnings?.length || 0,
    });
  }
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
