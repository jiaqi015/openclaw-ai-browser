import { ipcMain } from "electron";
import {
  appendMessageToThread,
  serializeThreadRuntimeState,
  selectThreadForTab,
} from "../../runtime/threads/ThreadStore.mjs";
import {
  runThreadAiTurn,
  runThreadOpenClawTaskTurn,
} from "../../runtime/threads/ThreadTurnService.mjs";
import { getContextSnapshotForTab } from "../../runtime/browser/TabContextService.mjs";
import { getLocalSkillDetail } from "../../runtime/openclaw/OpenClawManager.mjs";
import {
  runAiAction,
  runTrackedLocalAgentTask,
} from "./ThreadIpcActionService.mjs";

export function registerThreadIpcHandlers() {
  ipcMain.handle("thread:get-runtime-state", () => serializeThreadRuntimeState());
  ipcMain.handle("thread:append-message", (_e, payload) =>
    appendMessageToThread(payload ?? {}),
  );
  ipcMain.handle("thread:run-ai-turn", (_e, payload) =>
    runThreadAiTurn(payload ?? {}, {
      runAiAction,
      getContextSnapshotForTab,
      getLocalSkillDetail,
    }),
  );
  ipcMain.handle("thread:run-openclaw-task-turn", (_e, payload) =>
    runThreadOpenClawTaskTurn(payload ?? {}, {
      runLocalAgentTask: runTrackedLocalAgentTask,
      getContextSnapshotForTab,
    }),
  );
  ipcMain.handle("thread:select", (_e, payload) => selectThreadForTab(payload ?? {}));
}
