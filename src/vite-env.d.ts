/// <reference types="vite/client" />

declare global {
  interface SabrinaSkillTraceStep {
    type: "request" | "tool_call" | "tool_result" | "final";
    title: string;
    detail?: string;
    at?: string;
    exitCode?: number;
    durationMs?: number;
    isError?: boolean;
  }

  interface SabrinaSkillTrace {
    runId: string;
    requestId?: string;
    skillName: string;
    status: "requested" | "used" | "failed" | "fallback";
    failureReason?: string;
    steps: SabrinaSkillTraceStep[];
  }

  interface SabrinaChatMessageRecord {
    messageId: string;
    role: "user" | "assistant" | "system" | "error";
    text: string;
    skillTrace?: SabrinaSkillTrace;
  }

  interface SabrinaDesktopTab {
    tabId: string;
    title: string;
    url: string;
    loading: boolean;
    canGoBack: boolean;
    canGoForward: boolean;
    selectedText: string;
    favicon: string | null;
    lastError: string | null;
  }

  interface SabrinaDesktopSnapshot {
    tabs: SabrinaDesktopTab[];
    activeTabId: string | null;
  }

  interface SabrinaDesktopWindowState {
    isNormal: boolean;
    isMaximized: boolean;
    isFullScreen: boolean;
    isSimpleFullScreen?: boolean;
  }

  interface SabrinaHistoryEntry {
    id: string;
    url: string;
    title: string;
    visitedAt: string;
  }

  interface SabrinaBookmarkEntry {
    id: string;
    url: string;
    title: string;
    addedAt: string;
  }

  interface SabrinaDownloadEntry {
    id: string;
    url: string;
    fileName: string;
    mimeType: string;
    savePath: string;
    receivedBytes: number;
    totalBytes: number;
    state: "progressing" | "completed" | "cancelled" | "interrupted";
    paused: boolean;
    tabId: string | null;
    startedAt: string;
    updatedAt: string;
  }

  interface SabrinaBrowserLibraryState {
    history: SabrinaHistoryEntry[];
    bookmarks: SabrinaBookmarkEntry[];
    downloads: SabrinaDownloadEntry[];
  }

  interface SabrinaPageContext {
    snapshotId: string;
    capturedAt: string;
    title: string;
    url: string;
    hostname: string;
    contentType: string;
    selectedText: string;
    contentText: string;
    contentPreview: string;
    leadText: string;
    headings: string[];
    sections: Array<{
      id: string;
      title: string;
      summary: string;
    }>;
    links: Array<{
      href: string;
      label: string;
      external: boolean;
    }>;
    metadata: {
      description: string;
      language: string;
      documentContentType: string;
    };
    extraction: {
      pageTruncated: boolean;
      selectionTruncated: boolean;
      quality: "rich" | "balanced" | "lite" | "minimal";
      approxChars: number;
      maxPageChars: number;
    };
    source: "selection" | "page";
  }

  interface SabrinaAiResponse {
    message: string;
    context: SabrinaPageContext;
    model: string;
    sessionId?: string;
    agentId?: string;
    skillName?: string;
    skillMode?: "strict" | "assist";
    skillFallback?: boolean;
    skillFailureReason?: string;
    skillTrace?: SabrinaSkillTrace;
  }

  interface SabrinaAiAttachment {
    tabId: string;
    context: SabrinaPageContext;
  }

  interface SabrinaOpenClawBinding {
    bindingId: string;
    protocolVersion?: string;
    agentId: string;
    lobsterId: string;
    displayName: string;
    mode: "local" | "remote";
    status: "active" | "disconnected" | "pending";
    gatewayUrl: string;
    deviceId: string;
    hostLabel: string;
    openclawProfile?: string | null;
    openclawStateDir?: string | null;
    capabilities?: string[];
    note: string;
    scopes: Array<{
      id: string;
      label: string;
      description: string;
    }>;
    pairedAt: string;
    lastConnectedAt?: string;
  }

  interface SabrinaOpenClawModelOption {
    id: string;
    label: string;
    desc: string;
    available: boolean;
  }

  interface SabrinaOpenClawModelState {
    agentId: string;
    desiredModel: string | null;
    appliedModel: string | null;
    models: SabrinaOpenClawModelOption[];
  }

  interface SabrinaOpenClawSkillEntry {
    name: string;
    displayName?: string;
    description: string;
    eligible: boolean;
    ready: boolean;
    disabled: boolean;
    blockedByAllowlist?: boolean;
    source: string;
    bundled: boolean;
    emoji?: string;
    homepage?: string;
    declaredBrowserCapability?: {
      inputMode: "page-snapshot" | "source-url";
      sourceKinds: Array<"public-url" | "private-url" | "local-file">;
      useHint: string;
      source: "skill-metadata" | "sabrina-overlay" | "heuristic";
      overlay: boolean;
    } | null;
    browserCapabilityDeclared?: boolean;
    browserCapability?: {
      inputMode: "page-snapshot" | "source-url";
      sourceKinds: Array<"public-url" | "private-url" | "local-file">;
      useHint: string;
      source: "skill-metadata" | "sabrina-overlay" | "heuristic";
      overlay: boolean;
    };
    browserInputMode: "page-snapshot" | "source-url";
    browserSourceKinds?: Array<"public-url" | "private-url" | "local-file">;
    browserUseHint: string;
    browserCompatibilitySource?: "skill-metadata" | "sabrina-overlay" | "heuristic";
    browserCompatibilityOverlay?: boolean;
    missingSummary: string;
  }

  interface SabrinaOpenClawSkillCatalog {
    summary: {
      browserCapabilitySchemaVersion: string;
      total: number;
      eligible: number;
      ready: number;
      disabled: number;
      blockedByAllowlist: number;
      missingRequirements: number;
      capabilitySourceCounts: {
        declared: number;
        overlay: number;
        heuristic: number;
        metadata: number;
      };
    };
    skills: SabrinaOpenClawSkillEntry[];
  }

  interface SabrinaOpenClawSkillDetail extends SabrinaOpenClawSkillEntry {
    filePath: string;
    baseDir: string;
    missingReasons: string[];
    install: Array<{
      id: string;
      kind: string;
      label: string;
      bins: string[];
    }>;
  }

  interface SabrinaOpenClawBindingSetupStep {
    id: string;
    title: string;
    description: string;
    status: "pending" | "in_progress" | "completed" | "error";
  }

  interface SabrinaOpenClawBindingSetupState {
    status: "idle" | "bootstrapping" | "pairing" | "ready" | "degraded";
    target: "local" | "remote" | null;
    title: string;
    description: string;
    note?: string;
    primaryActionLabel?: string;
    secondaryActionLabel?: string;
    steps: SabrinaOpenClawBindingSetupStep[];
  }

  interface SabrinaOpenClawConnectionConfig {
    enabled: boolean;
    transport: "local" | "remote";
    driver?: "local-cli" | "ssh-cli" | "relay-paired";
    profile: string | null;
    stateDir: string | null;
    sshTarget?: string | null;
    sshPort?: number | null;
    relayUrl?: string | null;
    connectCode?: string | null;
    label?: string | null;
    agentId?: string | null;
  }

  interface SabrinaOpenClawConnectionState {
    status: "disconnected" | "connecting" | "connected" | "attention";
    target: "local" | "remote";
    transport: "local" | "remote";
    profile: string | null;
    stateDir: string | null;
    bindingId: string | null;
    summary: string;
    detail: string;
    commandHint: string;
    doctorHint: string;
    transportLabel: string;
    capabilities: string[];
    remoteSessionContract: {
      contractVersion: string;
      transport: "local" | "remote";
      driver: string | null;
      profile: string | null;
      stateDir: string | null;
      sshTarget: string | null;
      sshPort: number | null;
      relayUrl: string | null;
      agentId: string | null;
      features: string[];
    };
    lastCheckedAt: string | null;
    lastConnectedAt: string | null;
  }

  interface SabrinaThreadRecord {
    threadId: string;
    title: string;
    originUrl: string;
    pageKey: string | null;
    siteHost: string;
    siteLabel: string;
    updatedAt: string;
  }

  interface SabrinaThreadStoreState {
    threadsById: Record<string, SabrinaThreadRecord>;
    threadOrder: string[];
    messagesByThreadId: Record<string, SabrinaChatMessageRecord[]>;
    pageThreadIds: Record<string, string>;
  }

  interface SabrinaTabThreadRuntime {
    threadId: string;
    url: string;
    pageKey: string | null;
  }

  interface SabrinaThreadRuntimeResolution {
    state: SabrinaThreadStoreState;
    tabThreads: Record<string, SabrinaTabThreadRuntime>;
  }

  interface SabrinaThreadTurnResult {
    ok: boolean;
    errorMessage?: string;
    runtimeState: SabrinaThreadRuntimeResolution;
  }

  interface SabrinaOpenClawTaskRecord {
    taskId: string;
    kind: string;
    agentId: string;
    title: string;
    promptPreview: string;
    sourceUrl: string;
    threadId: string;
    sessionId: string;
    model: string;
    status: "running" | "completed" | "failed";
    responseText: string;
    errorMessage: string;
    createdAt: string;
    updatedAt: string;
    durationMs: number | null;
  }

  interface SabrinaOpenClawTaskState {
    tasks: SabrinaOpenClawTaskRecord[];
  }

  interface SabrinaOpenClawGatewayStatus {
    ok: boolean;
    serviceLabel: string;
    serviceLoaded: boolean;
    serviceStatus: string;
    bindMode: string;
    bindHost: string;
    port: number;
    probeUrl: string;
    rpcUrl: string;
    defaultAgentId: string;
    sessionCount: number;
    agentIds: string[];
    warnings: string[];
  }

  interface SabrinaOpenClawDeviceStatus {
    pendingCount: number;
    pairedCount: number;
    pairedDevices: Array<{
      deviceId: string;
      clientId: string;
      clientMode: string;
      platform: string;
      roles: string[];
      approvedAt: string;
      scopeCount: number;
    }>;
  }

  interface SabrinaOpenClawPairingStatus {
    channel: string | null;
    requestCount: number;
    requests: Array<{
      requestId: string;
      code: string;
      accountId?: string;
      fromLabel?: string;
      createdAt?: string;
      createdAtLabel?: string;
      raw: unknown;
    }>;
  }

  interface SabrinaOpenClawState {
    selectedTarget: "local" | "remote";
    connectionConfig: SabrinaOpenClawConnectionConfig;
    connectionState: SabrinaOpenClawConnectionState | null;
    binding: SabrinaOpenClawBinding | null;
    bindingSetupState: SabrinaOpenClawBindingSetupState;
    modelState: SabrinaOpenClawModelState | null;
    skillCatalog: SabrinaOpenClawSkillCatalog | null;
    gatewayStatus: SabrinaOpenClawGatewayStatus | null;
    deviceStatus: SabrinaOpenClawDeviceStatus | null;
    pairingStatus: SabrinaOpenClawPairingStatus | null;
    lastRefreshedAt: string | null;
    lastError: string;
  }

  interface SabrinaOpenClawDoctorCheck {
    id: string;
    label: string;
    status: "pass" | "fail" | "warn";
    detail: string;
  }

  interface SabrinaOpenClawDoctorReport {
    ok: boolean;
    target: "local" | "remote";
    transport: "local" | "remote";
    transportLabel: string;
    profile: string | null;
    stateDir: string;
    configPath: string;
    checkCount: number;
    failureCount: number;
    warningCount: number;
    checks: SabrinaOpenClawDoctorCheck[];
  }

  interface SabrinaBrowserMemoryRecord {
    schemaVersion: string;
    id: string;
    kind: string;
    url: string;
    host: string;
    title: string;
    summary: string;
    entities: string[];
    keywords: string[];
    source: "browser";
    capturedAt: string;
    updatedAt: string;
    metadata: Record<string, unknown>;
  }

  interface SabrinaTurnJournalEntry {
    journalId: string;
    turnId: string;
    createdAt: string;
    threadId: string;
    userText: string;
    turnType: string;
    strategy: string;
    policyDecision: string;
    summary: string;
    browserContext: Record<string, unknown> | null;
    skill: Record<string, unknown> | null;
    inputPolicy: Record<string, unknown> | null;
    executionContract: Record<string, unknown> | null;
    receipt: {
      status?: string;
      summary?: string;
      userVisibleMessage?: string;
      trace?: Record<string, unknown> | null;
      evidence?: Record<string, unknown> | null;
    } | null;
    response: Record<string, unknown> | null;
    errorMessage: string;
    contextPackageSummary: Record<string, unknown> | null;
  }

  interface SabrinaDiagnosticsEntry {
    id: string;
    timestamp: string;
    level: "error" | "warn" | "info" | "debug";
    scope: string;
    source: "main" | "renderer" | "guest" | "network";
    message: string;
    details: unknown;
    tabId: string | null;
    url: string;
    kind: string;
  }

  interface SabrinaNetworkEvent {
    id: string;
    timestamp: string;
    tabId: string | null;
    webContentsId: number | null;
    url: string;
    method: string;
    resourceType: string;
    phase: "completed" | "failed" | "redirected";
    statusCode: number | null;
    statusLine: string;
    durationMs: number | null;
    fromCache: boolean;
    error: string;
    redirectURL: string;
  }

  interface SabrinaDiagnosticsState {
    summary: {
      appName: string;
      appVersion: string;
      electronVersion: string;
      chromeVersion: string;
      nodeVersion: string;
      platform: string;
      arch: string;
      isPackaged: boolean;
      startedAt: string;
      startedAtLabel: string;
      uptimeSec: number;
      logDir: string;
      humanLogPath: string;
      structuredLogPath: string;
      counters: {
        total: number;
        error: number;
        warn: number;
        info: number;
        rendererErrors: number;
        guestCrashes: number;
        networkFailures: number;
        aiFailures: number;
        aiSuccess: number;
      };
      ai: {
        total: number;
        success: number;
        failure: number;
        lastAction: string;
        lastAgentId: string;
        lastModel: string;
        lastDurationMs: number;
        avgDurationMs: number;
        lastError: string;
        lastFinishedAt: string;
      };
      browser: {
        tabCount: number;
        activeTabId: string | null;
        activeTabUrl: string;
      };
      memory: {
        rssBytes: number;
        heapUsedBytes: number;
        heapTotalBytes: number;
        freeSystemMemoryBytes: number;
        totalSystemMemoryBytes: number;
        formatted: {
          rss: string;
          heapUsed: string;
          heapTotal: string;
          freeSystem: string;
          totalSystem: string;
        };
        extra: unknown;
      };
    };
    entries: SabrinaDiagnosticsEntry[];
    network: SabrinaNetworkEvent[];
  }

  interface GenTabGenerateResult {
    success: boolean;
    error?: string;
    gentab?: {
      schemaVersion: "1" | "2";
      type: "table" | "list" | "timeline" | "comparison" | "card-grid";
      title: string;
      description?: string;
      summary?: string;
      insights?: string[];
      sections?: Array<{
        id: string;
        title: string;
        description?: string;
        bullets: string[];
      }>;
      suggestedPrompts?: string[];
      sources?: Array<{
        url: string;
        title: string;
        host?: string;
        whyIncluded?: string;
      }>;
      items: Array<{
        id: string;
        title: string;
        description?: string;
        sourceUrl: string;
        sourceTitle: string;
        fields?: Record<string, string>;
        date?: string;
      }>;
      metadata: {
        sourceTabIds: string[];
        requestedReferenceTabIds?: string[];
        missingReferenceTabIds?: string[];
        selectionState?: "page" | "selection";
        totalApproxChars?: number;
        userIntent: string;
        generatedAt: string;
        preferredType?: "auto" | "table" | "list" | "timeline" | "comparison" | "card-grid";
      };
    };
  }

  interface Window {
    sabrinaDesktop?: {
      platform: string;
      shell: "electron";
      getSnapshot: () => Promise<SabrinaDesktopSnapshot>;
      getLibraryState: () => Promise<SabrinaBrowserLibraryState>;
      getWindowState: () => Promise<SabrinaDesktopWindowState>;
      createTab: (input?: string) => Promise<SabrinaDesktopTab>;
      activateTab: (tabId: string) => Promise<SabrinaDesktopSnapshot>;
      closeTab: (tabId: string) => Promise<SabrinaDesktopSnapshot>;
      navigate: (input: string) => Promise<SabrinaDesktopSnapshot>;
      goBack: () => Promise<SabrinaDesktopSnapshot>;
      goForward: () => Promise<SabrinaDesktopSnapshot>;
      reload: () => Promise<SabrinaDesktopSnapshot>;
      setBrowserBounds: (bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
      }) => Promise<{
        x: number;
        y: number;
        width: number;
        height: number;
      }>;
      setUiLocale: (locale: "zh-CN" | "en-US") => Promise<"zh-CN" | "en-US">;
      showBrowserMenu: (position: {
        x: number;
        y: number;
      }) => Promise<boolean>;
      openExternal: (url: string) => Promise<void>;
      toggleBookmark: (payload: {
        url: string;
        title?: string;
      }) => Promise<SabrinaBrowserLibraryState>;
      removeBookmark: (url: string) => Promise<SabrinaBrowserLibraryState>;
      clearHistory: () => Promise<SabrinaBrowserLibraryState>;
      openDownload: (downloadId: string) => Promise<void>;
      revealDownload: (downloadId: string) => Promise<void>;
      threads?: {
        getRuntimeState: () => Promise<SabrinaThreadRuntimeResolution>;
        appendMessage: (payload: {
          threadId: string;
          message: SabrinaChatMessageRecord;
        }) => Promise<SabrinaThreadRuntimeResolution>;
        runAiTurn: (payload: {
          threadId: string;
          userText: string;
          referenceTabIds?: string[];
          actionPayload: {
            action: "summarize" | "key-points" | "explain-selection" | "ask";
            agentId?: string;
            model: string;
            prompt?: string;
            skillName?: string;
            skillMode?: "strict" | "assist";
            sessionId?: string;
            tabId?: string;
            uiLocale?: "zh-CN" | "en-US";
            assistantLocaleMode?: "follow-ui" | "zh-CN" | "en-US";
          };
        }) => Promise<SabrinaThreadTurnResult>;
        runOpenClawTaskTurn: (payload: {
          threadId: string;
          userText: string;
          referenceTabIds?: string[];
          taskPayload: {
            agentId?: string;
            tabId: string;
            prompt?: string;
            sessionId?: string;
            thinking?: string;
            uiLocale?: "zh-CN" | "en-US";
            assistantLocaleMode?: "follow-ui" | "zh-CN" | "en-US";
          };
        }) => Promise<SabrinaThreadTurnResult>;
        selectThread: (payload: {
          tabId: string;
          threadId: string;
          url: string;
        }) => Promise<SabrinaThreadRuntimeResolution>;
        onRuntimeState: (
          listener: (state: SabrinaThreadRuntimeResolution) => void,
        ) => () => void;
      };
      monitor?: {
        getState: (params?: {
          entryLimit?: number;
          networkLimit?: number;
        }) => Promise<SabrinaDiagnosticsState>;
        openLogDirectory: () => Promise<void>;
        revealHumanLogFile: () => Promise<void>;
        reportRendererEvent: (payload: {
          level?: "error" | "warn" | "info";
          scope?: string;
          message: string;
          details?: unknown;
          tabId?: string;
          url?: string;
          kind?: string;
        }) => Promise<SabrinaDiagnosticsEntry>;
        onState: (
          listener: (state: SabrinaDiagnosticsState) => void,
        ) => () => void;
      };
      openclaw?: {
        getState: () => Promise<SabrinaOpenClawState>;
        getConnectionState: () => Promise<SabrinaOpenClawConnectionState | null>;
        refreshState: (params?: {
          target?: "local" | "remote";
        }) => Promise<SabrinaOpenClawState>;
        connect: (params?: {
          target?: "local" | "remote";
          profile?: string;
          stateDir?: string;
          driver?: "local-cli" | "ssh-cli" | "relay-paired";
          sshTarget?: string;
          sshPort?: number;
          relayUrl?: string;
          connectCode?: string;
          label?: string;
          agentId?: string;
        }) => Promise<SabrinaOpenClawState>;
        disconnect: (params?: {
          target?: "local" | "remote";
          profile?: string;
          stateDir?: string;
          driver?: "local-cli" | "ssh-cli" | "relay-paired";
          sshTarget?: string;
          sshPort?: number;
          relayUrl?: string;
          connectCode?: string;
          label?: string;
          agentId?: string;
        }) => Promise<SabrinaOpenClawState>;
        doctor: (params?: {
          target?: "local" | "remote";
          driver?: "local-cli" | "ssh-cli" | "relay-paired";
          profile?: string;
          stateDir?: string;
          sshTarget?: string;
          sshPort?: number;
          relayUrl?: string;
          connectCode?: string;
          label?: string;
          agentId?: string;
        }) => Promise<SabrinaOpenClawDoctorReport>;
        setBindingTarget: (target: "local" | "remote") => Promise<SabrinaOpenClawState>;
        getLocalBinding: () => Promise<SabrinaOpenClawBinding>;
        getLocalModels: (params?: {
          agentId?: string;
        }) => Promise<SabrinaOpenClawModelState>;
        setLocalModel: (params: {
          agentId?: string;
          model: string;
        }) => Promise<SabrinaOpenClawState>;
        getBindingSetupState: () => Promise<SabrinaOpenClawBindingSetupState>;
        beginBindingSetup: (params: {
          target: "local" | "remote";
        }) => Promise<SabrinaOpenClawState>;
        listSkills: () => Promise<SabrinaOpenClawSkillCatalog>;
        getSkillDetail: (params: {
          skillName: string;
        }) => Promise<SabrinaOpenClawSkillDetail>;
        getPairingStatus: (params?: {
          channel?: string;
          accountId?: string;
        }) => Promise<SabrinaOpenClawPairingStatus>;
        approvePairingRequest: (params: {
          code: string;
          channel?: string;
          accountId?: string;
          notify?: boolean;
        }) => Promise<SabrinaOpenClawState>;
        approveDeviceRequest: (params: {
          requestId?: string;
          latest?: boolean;
          token?: string;
          password?: string;
          url?: string;
        }) => Promise<SabrinaOpenClawState>;
        getTaskState: () => Promise<SabrinaOpenClawTaskState>;
        saveMemory: (payload: Partial<SabrinaBrowserMemoryRecord>) => Promise<{
          ok: boolean;
          record: SabrinaBrowserMemoryRecord;
          stats: {
            path: string;
            count: number;
            latestCapturedAt: string | null;
          };
        }>;
        searchMemory: (payload: {
          query?: string;
          limit?: number;
        }) => Promise<{
          ok: boolean;
          query: string;
          records: SabrinaBrowserMemoryRecord[];
          stats: {
            path: string;
            count: number;
            latestCapturedAt: string | null;
          };
        }>;
        getTurnJournal: (payload?: {
          limit?: number;
          threadId?: string;
          status?: string;
        }) => Promise<{
          ok: boolean;
          entries: SabrinaTurnJournalEntry[];
          stats: {
            path: string;
            count: number;
            latestCreatedAt: string | null;
            latestThreadId: string | null;
            latestTurnId: string | null;
            latestStatus: string | null;
            statusCounts: Record<string, number>;
          };
        }>;
        searchTurnJournal: (payload: {
          query?: string;
          limit?: number;
        }) => Promise<{
          ok: boolean;
          query: string;
          entries: SabrinaTurnJournalEntry[];
          stats: {
            path: string;
            count: number;
            latestCreatedAt: string | null;
            latestThreadId: string | null;
            latestTurnId: string | null;
            latestStatus: string | null;
            statusCounts: Record<string, number>;
          };
        }>;
        runLocalAgent: (params: {
          agentId?: string;
          message: string;
          sessionId?: string;
          thinking?: string;
        }) => Promise<{
          text: string;
          sessionId: string | null;
          model: string | null;
          provider: string | null;
          durationMs: number | null;
        }>;
        onState: (
          listener: (state: SabrinaOpenClawState) => void,
        ) => () => void;
        onTaskState: (
          listener: (state: SabrinaOpenClawTaskState) => void,
        ) => () => void;
      };
      gentab?: {
        createGenTab: (params: {
          genId: string;
          referenceTabIds: string[];
          userIntent: string;
          preferredType?: "auto" | "table" | "list" | "timeline" | "comparison" | "card-grid";
        }) => Promise<{ success: boolean; tab: SabrinaDesktopTab }>;
        generate: (params: {
          genId: string;
          referenceTabIds: string[];
          userIntent: string;
          preferredType?: "auto" | "table" | "list" | "timeline" | "comparison" | "card-grid";
          uiLocale?: "zh-CN" | "en-US";
          assistantLocaleMode?: "follow-ui" | "zh-CN" | "en-US";
        }) => Promise<GenTabGenerateResult>;
        closeGenTab: (genId: string) => Promise<{ success: boolean }>;
        markGenerationCompleted: (genId: string) => void;
        onGenerationCompleted: (
          listener: (genId: string) => void,
        ) => () => void;
      };
      browser?: {
        openUrlInNewTab: (url: string) => void;
      };
      onStateChange: (
        listener: (state: SabrinaDesktopSnapshot) => void,
      ) => () => void;
      onLibraryStateChange: (
        listener: (state: SabrinaBrowserLibraryState) => void,
      ) => () => void;
      onWindowStateChange: (
        listener: (state: SabrinaDesktopWindowState) => void,
      ) => () => void;
      onBrowserMenuCommand?: (
        listener: (
          command:
            | "history"
            | "bookmarks"
            | "downloads"
            | "diagnostics"
            | "clear-history"
            | "general-settings"
            | "settings"
            | "download-latest",
        ) => void,
      ) => () => void;
    };
  }
}

export {};
