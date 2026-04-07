const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sabrinaDesktop", {
  platform: process.platform,
  shell: "electron",
  getSnapshot: () => ipcRenderer.invoke("browser:get-snapshot"),
  getLibraryState: () => ipcRenderer.invoke("browser:get-library-state"),
  getWindowState: () => ipcRenderer.invoke("window:get-state"),
  createTab: (input) => ipcRenderer.invoke("browser:create-tab", { input }),
  activateTab: (tabId) => ipcRenderer.invoke("browser:activate-tab", { tabId }),
  closeTab: (tabId) => ipcRenderer.invoke("browser:close-tab", { tabId }),
  navigate: (input) => ipcRenderer.invoke("browser:navigate", { input }),
  goBack: () => ipcRenderer.invoke("browser:go-back"),
  goForward: () => ipcRenderer.invoke("browser:go-forward"),
  reload: () => ipcRenderer.invoke("browser:reload"),
  setBrowserBounds: (bounds) => ipcRenderer.invoke("browser:set-bounds", bounds),
  setUiLocale: (locale) => ipcRenderer.invoke("browser:set-ui-locale", { locale }),
  showBrowserMenu: (position) => ipcRenderer.invoke("browser:show-menu", position),
  openExternal: (url) => ipcRenderer.invoke("browser:open-external", { url }),
  toggleBookmark: (payload) => ipcRenderer.invoke("browser:toggle-bookmark", payload),
  removeBookmark: (url) => ipcRenderer.invoke("browser:remove-bookmark", { url }),
  clearHistory: () => ipcRenderer.invoke("browser:clear-history"),
  openDownload: (downloadId) => ipcRenderer.invoke("browser:open-download", { downloadId }),
  revealDownload: (downloadId) =>
    ipcRenderer.invoke("browser:reveal-download", { downloadId }),
  threads: {
    getRuntimeState: () => ipcRenderer.invoke("thread:get-runtime-state"),
    appendMessage: (payload) => ipcRenderer.invoke("thread:append-message", payload),
    runAiTurn: (payload) => ipcRenderer.invoke("thread:run-ai-turn", payload),
    runOpenClawTaskTurn: (payload) =>
      ipcRenderer.invoke("thread:run-openclaw-task-turn", payload),
    selectThread: (payload) => ipcRenderer.invoke("thread:select", payload),
    onRuntimeState: (listener) => {
      const wrapped = (_event, state) => listener(state);
      ipcRenderer.on("thread:runtime-state", wrapped);
      return () => {
        ipcRenderer.removeListener("thread:runtime-state", wrapped);
      };
    },
  },
  monitor: {
    getState: (params) => ipcRenderer.invoke("monitor:get-state", params),
    openLogDirectory: () => ipcRenderer.invoke("monitor:open-log-directory"),
    revealHumanLogFile: () => ipcRenderer.invoke("monitor:reveal-human-log-file"),
    reportRendererEvent: (payload) =>
      ipcRenderer.invoke("monitor:report-renderer-event", payload),
    onState: (listener) => {
      const wrapped = (_event, state) => listener(state);
      ipcRenderer.on("monitor:state", wrapped);
      return () => {
        ipcRenderer.removeListener("monitor:state", wrapped);
      };
    },
  },
  openclaw: {
    getState: () => ipcRenderer.invoke("openclaw:get-state"),
    getConnectionState: () => ipcRenderer.invoke("openclaw:get-connection-state"),
    refreshState: (params) =>
      ipcRenderer.invoke("openclaw:refresh-state", params),
    connect: (params) => ipcRenderer.invoke("openclaw:connect", params),
    disconnect: (params) => ipcRenderer.invoke("openclaw:disconnect", params),
    doctor: (params) => ipcRenderer.invoke("openclaw:doctor", params),
    probeConnection: (params) =>
      ipcRenderer.invoke("openclaw:probe-connection", params),
    getSupportSnapshot: (params) =>
      ipcRenderer.invoke("openclaw:get-support-snapshot", params),
    createRelayConnectCode: (params) =>
      ipcRenderer.invoke("openclaw:create-relay-connect-code", params),
    getRelayPairingState: (params) =>
      ipcRenderer.invoke("openclaw:get-relay-pairing-state", params),
    sendRelayEnvelope: (params) =>
      ipcRenderer.invoke("openclaw:send-relay-envelope", params),
    listRelayEnvelopes: (params) =>
      ipcRenderer.invoke("openclaw:list-relay-envelopes", params),
    setBindingTarget: (target) =>
      ipcRenderer.invoke("openclaw:set-binding-target", { target }),
    saveConnectionPreset: (params) =>
      ipcRenderer.invoke("openclaw:save-connection-preset", params),
    removeSavedConnection: (savedConnectionId) =>
      ipcRenderer.invoke("openclaw:remove-saved-connection", { savedConnectionId }),
    selectSavedConnection: (savedConnectionId) =>
      ipcRenderer.invoke("openclaw:select-saved-connection", { savedConnectionId }),
    getLocalBinding: () => ipcRenderer.invoke("openclaw:get-local-binding"),
    getLocalModels: (params) =>
      ipcRenderer.invoke("openclaw:get-local-models", params),
    setLocalModel: (params) =>
      ipcRenderer.invoke("openclaw:set-local-model", params),
    getBindingSetupState: () =>
      ipcRenderer.invoke("openclaw:get-binding-setup-state"),
    beginBindingSetup: (params) =>
      ipcRenderer.invoke("openclaw:begin-binding-setup", params),
    listSkills: () =>
      ipcRenderer.invoke("openclaw:list-skills"),
    getSkillDetail: (params) =>
      ipcRenderer.invoke("openclaw:get-skill-detail", params),
    getPairingStatus: (params) =>
      ipcRenderer.invoke("openclaw:get-pairing-status", params),
    approvePairingRequest: (params) =>
      ipcRenderer.invoke("openclaw:approve-pairing-request", params),
    approveDeviceRequest: (params) =>
      ipcRenderer.invoke("openclaw:approve-device-request", params),
    getTaskState: () =>
      ipcRenderer.invoke("openclaw:get-task-state"),
    saveMemory: (payload) =>
      ipcRenderer.invoke("openclaw:save-memory", payload),
    searchMemory: (payload) =>
      ipcRenderer.invoke("openclaw:search-memory", payload),
    getTurnJournal: (payload) =>
      ipcRenderer.invoke("openclaw:get-turn-journal", payload),
    searchTurnJournal: (payload) =>
      ipcRenderer.invoke("openclaw:search-turn-journal", payload),
    pruneTurnJournal: (payload) =>
      ipcRenderer.invoke("openclaw:prune-turn-journal", payload),
    runLocalAgent: (params) =>
      ipcRenderer.invoke("openclaw:run-local-agent", params),
    onState: (listener) => {
      const wrapped = (_event, state) => listener(state);
      ipcRenderer.on("openclaw:state", wrapped);
      return () => {
        ipcRenderer.removeListener("openclaw:state", wrapped);
      };
    },
    onTaskState: (listener) => {
      const wrapped = (_event, state) => listener(state);
      ipcRenderer.on("openclaw:task-state", wrapped);
      return () => {
        ipcRenderer.removeListener("openclaw:task-state", wrapped);
      };
    },
  },
  onStateChange: (listener) => {
    const wrapped = (_event, state) => listener(state);
    ipcRenderer.on("browser:state", wrapped);
    return () => {
      ipcRenderer.removeListener("browser:state", wrapped);
    };
  },
  onLibraryStateChange: (listener) => {
    const wrapped = (_event, state) => listener(state);
    ipcRenderer.on("browser:library-state", wrapped);
    return () => {
      ipcRenderer.removeListener("browser:library-state", wrapped);
    };
  },
  onWindowStateChange: (listener) => {
    const wrapped = (_event, state) => listener(state);
    ipcRenderer.on("window:state", wrapped);
    return () => {
      ipcRenderer.removeListener("window:state", wrapped);
    };
  },
  onBrowserMenuCommand: (listener) => {
    const wrapped = (_event, command) => listener(command);
    ipcRenderer.on("browser:menu-command", wrapped);
    return () => {
      ipcRenderer.removeListener("browser:menu-command", wrapped);
    };
  },
  gentab: {
    createGenTab: (params) => ipcRenderer.invoke("gentab:create", params),
    generate: (params) => ipcRenderer.invoke("gentab:generate", params),
    closeGenTab: (genId) => ipcRenderer.invoke("gentab:close", { genId }),
    markGenerationCompleted: (genId) => {
      ipcRenderer.send("gentab:generation-completed", { genId });
    },
    onGenerationCompleted: (listener) => {
      const wrapped = (_event, payload) => listener(`${payload?.genId ?? ""}`.trim());
      ipcRenderer.on("gentab:generation-completed", wrapped);
      return () => {
        ipcRenderer.removeListener("gentab:generation-completed", wrapped);
      };
    },
  },
  browser: {
    openUrlInNewTab: (url) => ipcRenderer.invoke("browser:create-tab", { input: url }),
  },
});
