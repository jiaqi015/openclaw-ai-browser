import { ipcMain } from "electron";
import { 
  createAgentTask, 
  startAgentTask, 
  respondToConfirm, 
  cancelAgentTask,
  getAgentTask
} from "../../runtime/turns/BrowserAgentTaskService.mjs";
import { runLocalAgentTurn } from "../../runtime/openclaw/OpenClawManager.mjs";
import { getContextSnapshotForTab } from "../../runtime/browser/TabContextService.mjs";

export function registerAgentIpcHandlers() {
  // 启动 Agent 任务
  ipcMain.handle("agent:run-browser-task", async (event, payload) => {
    const { tabId, task, userData, threadId } = payload;
    
    try {
      const taskId = createAgentTask({ tabId, task, userData, threadId });
      
      // 异步启动任务，不阻塞 IPC
      startAgentTask(taskId, {
        runLocalAgentTurn,
        getContextSnapshotForTab,
        onProgress: (id, data) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send("agent:progress", { taskId: id, ...data });
          }
        },
        onRequestConfirm: (id, data) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send("agent:request-confirm", { taskId: id, ...data });
          }
        },
        onTaskEnd: (id, taskObj) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send("agent:completed", {
              taskId: id,
              status: taskObj.status,
              summary: taskObj.summary,
              error: taskObj.error,
              warnings: taskObj.warnings,
            });
          }
        }
      });

      return { ok: true, taskId };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  // 用户回应确认
  ipcMain.handle("agent:confirm-response", (_e, { taskId, confirmed }) => {
    respondToConfirm(taskId, confirmed);
    return { ok: true };
  });

  // 中断任务
  ipcMain.handle("agent:stop", (_e, { taskId }) => {
    cancelAgentTask(taskId);
    return { ok: true };
  });

  // 获取任务状态
  ipcMain.handle("agent:get-task", (_e, { taskId }) => {
    const task = getAgentTask(taskId);
    if (!task) return null;
    // 脱敏返回
    const { abortController, resolveConfirm, ...rest } = task;
    return rest;
  });
}
