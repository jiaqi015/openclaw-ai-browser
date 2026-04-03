import { ipcMain } from "electron";
import {
  buildLocalOpenClawBinding,
  getBindingSetupState,
  getLocalModelState,
  getLocalPairingStatus,
  getLocalSkillCatalog,
  getLocalSkillDetail,
  runLocalAgentTurn,
} from "../../runtime/openclaw/OpenClawManager.mjs";
import { serializeOpenClawTaskState } from "../../runtime/openclaw/OpenClawTaskStore.mjs";
import {
  approveOpenClawDeviceRequest,
  approveOpenClawPairingRequest,
  connectOpenClaw,
  beginOpenClawBindingSetup,
  disconnectOpenClaw,
  doctorOpenClaw,
  getOpenClawConnectionState,
  getSerializedOpenClawState,
  refreshOpenClawRuntimeState,
  saveOpenClawBrowserMemory,
  getOpenClawTurnJournal,
  searchOpenClawTurnJournal,
  searchOpenClawBrowserMemory,
  selectOpenClawBindingTarget,
  setOpenClawLocalModel,
} from "../../runtime/openclaw/OpenClawRuntimeService.mjs";

export function registerOpenClawIpcHandlers() {
  ipcMain.handle("openclaw:get-state", () => getSerializedOpenClawState());
  ipcMain.handle("openclaw:get-connection-state", () => getOpenClawConnectionState());
  ipcMain.handle("openclaw:refresh-state", (_e, payload) =>
    refreshOpenClawRuntimeState(payload ?? {}),
  );
  ipcMain.handle("openclaw:connect", (_e, payload) => connectOpenClaw(payload ?? {}));
  ipcMain.handle("openclaw:disconnect", (_e, payload) =>
    disconnectOpenClaw(payload ?? {}),
  );
  ipcMain.handle("openclaw:doctor", (_e, payload) => doctorOpenClaw(payload ?? {}));
  ipcMain.handle("openclaw:set-binding-target", (_e, payload) =>
    selectOpenClawBindingTarget(payload?.target),
  );
  ipcMain.handle("openclaw:get-local-binding", () => buildLocalOpenClawBinding());
  ipcMain.handle("openclaw:get-local-models", (_e, payload) =>
    getLocalModelState(payload?.agentId),
  );
  ipcMain.handle("openclaw:set-local-model", (_e, payload) =>
    setOpenClawLocalModel(payload ?? {}),
  );
  ipcMain.handle("openclaw:get-binding-setup-state", (_e, payload) =>
    getBindingSetupState(payload ?? {}),
  );
  ipcMain.handle("openclaw:begin-binding-setup", (_e, payload) =>
    beginOpenClawBindingSetup(payload ?? {}),
  );
  ipcMain.handle("openclaw:list-skills", () => getLocalSkillCatalog());
  ipcMain.handle("openclaw:get-skill-detail", (_e, payload) =>
    getLocalSkillDetail(payload?.skillName),
  );
  ipcMain.handle("openclaw:get-pairing-status", (_e, payload) =>
    getLocalPairingStatus(payload ?? {}),
  );
  ipcMain.handle("openclaw:approve-pairing-request", (_e, payload) =>
    approveOpenClawPairingRequest(payload ?? {}),
  );
  ipcMain.handle("openclaw:approve-device-request", (_e, payload) =>
    approveOpenClawDeviceRequest(payload ?? {}),
  );
  ipcMain.handle("openclaw:get-task-state", () => serializeOpenClawTaskState());
  ipcMain.handle("openclaw:save-memory", (_e, payload) =>
    saveOpenClawBrowserMemory(payload ?? {}),
  );
  ipcMain.handle("openclaw:search-memory", (_e, payload) =>
    searchOpenClawBrowserMemory(payload ?? {}),
  );
  ipcMain.handle("openclaw:get-turn-journal", (_e, payload) =>
    getOpenClawTurnJournal(payload ?? {}),
  );
  ipcMain.handle("openclaw:search-turn-journal", (_e, payload) =>
    searchOpenClawTurnJournal(payload ?? {}),
  );
  ipcMain.handle("openclaw:run-local-agent", (_e, payload) =>
    runLocalAgentTurn(payload ?? {}),
  );
}
