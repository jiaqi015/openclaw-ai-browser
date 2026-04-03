import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useAppViewState } from "./use-app-view-state";
import { useBrowserBoundsSync } from "./use-browser-bounds-sync";
import { useBrowserMenuState } from "./use-browser-menu-state";
import { useSidebarResize } from "./use-sidebar-resize";
import { useTabSurfaceState } from "./use-tab-surface-state";
import { AppMainSurface } from "../components/app-main-surface";
import { AppSidebarPane } from "../components/app-sidebar-pane";
import { BrowserChrome } from "../components/browser-chrome";
import { NewTabSurface } from "../components/new-tab-surface";
import { useAppController } from "../shell/useAppController";
import { useUiPreferences } from "./use-ui-preferences";
import { useSkillPreferences } from "../state/useSkillPreferences";

type AppControllerState = ReturnType<typeof useAppController>;
type UiPreferences = ReturnType<typeof useUiPreferences>["preferences"];

export function useAppShellState({
  controller,
  preferences,
}: {
  controller: AppControllerState;
  preferences: UiPreferences;
}) {
  const { isBrowserMenuOpen, setIsBrowserMenuOpen, browserMenuRef } =
    useBrowserMenuState();
  const { sidebarWidth, isDraggingState, handleResizeStart } = useSidebarResize();
  const {
    pinnedSkillNames,
    hiddenSkillNames,
    togglePinnedSkill,
    toggleHiddenSkill,
  } = useSkillPreferences();
  const browserSurfaceRef = useRef<HTMLDivElement>(null);
  const [isMacWindowExpanded, setIsMacWindowExpanded] = useState(false);

  const {
    inputUrl,
    setInputUrl,
    clearInputUrl,
    newTabInput,
    setNewTabInput,
    displayTabs,
    surfaceMode,
    isNewTabSurface,
    addressDisplay,
    openBlankTab,
    openInternalTab,
    handleNavigate,
    handleNewTabChatSubmit,
    handleMenuCommand,
  } = useTabSurfaceState({
    tabs: controller.tabs,
    activeTab: controller.activeTab,
    searchEngine: preferences.defaultSearchEngine,
    createTab: controller.createTab,
    navigateCurrentTab: controller.navigateCurrentTab,
    clearHistory: controller.clearHistory,
    sendMessage: controller.sendMessage,
    sendNewTabChatMessage: controller.sendMessage,
    subscribeBrowserMenuCommand: controller.subscribeBrowserMenuCommand,
  });

  const {
    handleBookmarkToggle,
    handleChat,
    handleSendToOpenClaw,
    hasConnectedLobster,
    lobsterLabel,
    lobsterStatus,
    modelSelectValue,
    models,
    sidebarChatKey,
    sidebarQuickActions,
    visibleMessages,
  } = useAppViewState({
    activeMessages: controller.activeMessages,
    activeTab: controller.activeTab,
    activeThreadId: controller.activeThreadId,
    binding: controller.binding,
    connectionState: controller.connectionState,
    clearSelectedComposerSkill: controller.clearSelectedComposerSkill,
    composerText: controller.composerText,
    hiddenSkillNames,
    isModelSwitching: controller.isModelSwitching,
    isThinking: controller.isThinking,
    modelOptions: controller.modelOptions,
    pinnedSkillNames,
    selectedComposerSkill: controller.selectedComposerSkill,
    selectedModel: controller.selectedModel,
    sendMessage: controller.sendMessage,
    sendToOpenClaw: controller.sendToOpenClaw,
    setSelectedComposerSkill: controller.setSelectedComposerSkill,
    skillCatalog: controller.skillCatalog,
    surfaceMode,
    toggleBookmark: controller.toggleBookmark,
  });

  useEffect(() => {
    if (!controller.isMacDesktop) {
      setIsMacWindowExpanded(false);
      return;
    }

    setIsMacWindowExpanded(
      Boolean(
        !controller.windowState.isNormal ||
          controller.windowState.isMaximized ||
          controller.windowState.isFullScreen ||
          controller.windowState.isSimpleFullScreen,
      ),
    );
  }, [controller.isMacDesktop, controller.windowState]);

  useBrowserBoundsSync({
    browserSurfaceRef,
    surfaceMode,
    activeTabId: controller.activeTab?.tabId,
    sidebarOpen: controller.sidebarOpen,
    sidebarWidth,
    setBrowserBounds: controller.setBrowserBounds,
  });

  async function handleBrowserMenuTrigger(
    event: ReactMouseEvent<HTMLButtonElement>,
  ) {
    if (controller.supportsNativeBrowserMenu) {
      const rect = event.currentTarget.getBoundingClientRect();
      await controller.showBrowserMenu({
        x: Math.round(rect.right - 176),
        y: Math.round(rect.bottom + 8),
      });
      return;
    }

    setIsBrowserMenuOpen((current) => !current);
  }

  const browserChromeProps: ComponentProps<typeof BrowserChrome> = {
    displayTabs,
    activeTabId: controller.activeTab?.tabId,
    activeTabCanGoBack: Boolean(controller.activeTab?.canGoBack),
    activeTabCanGoForward: Boolean(controller.activeTab?.canGoForward),
    addressDisplay,
    isBookmarked: controller.isBookmarked,
    isBrowserMenuOpen,
    isMacDesktop: controller.isMacDesktop,
    isMacWindowExpanded,
    sidebarOpen: controller.sidebarOpen,
    supportsNativeBrowserMenu: controller.supportsNativeBrowserMenu,
    browserMenuRef,
    onActivateTab: (tabId) => {
      void controller.activateTab(tabId);
      clearInputUrl();
    },
    onCloseTab: (tabId) => {
      void controller.closeTab(tabId);
    },
    onCreateTab: () => {
      void openBlankTab();
    },
    onAddressChange: setInputUrl,
    onAddressBlur: clearInputUrl,
    onNavigate: () => {
      void handleNavigate(addressDisplay);
    },
    onGoBack: () => {
      void controller.goBack();
    },
    onGoForward: () => {
      void controller.goForward();
    },
    onReload: () => {
      void controller.reloadCurrentTab();
    },
    onToggleBookmark: () => {
      void handleBookmarkToggle();
    },
    onBrowserMenuTrigger: (event) => {
      void handleBrowserMenuTrigger(event);
    },
    onCloseMenu: () => {
      setIsBrowserMenuOpen(false);
    },
    onSelectMenu: (command) => {
      void handleMenuCommand(command);
    },
    onToggleSidebar: () => controller.setSidebarOpen(!controller.sidebarOpen),
  };

  const newTabSurfaceProps: ComponentProps<typeof NewTabSurface> = {
    hasConnectedLobster,
    isModelSwitching: controller.isModelSwitching,
    isThinking: controller.isThinking,
    modelSelectValue,
    models,
    inputValue: newTabInput,
    messages: visibleMessages,
    onChangeInput: setNewTabInput,
    onSelectModel: (modelId) => {
      void controller.setSelectedModel(modelId);
    },
    onSubmit: () => {
      void handleNewTabChatSubmit();
    },
  };

  const mainSurfaceProps: ComponentProps<typeof AppMainSurface> = {
    surfaceMode,
    browserSurfaceRef,
    activeTabUrl: controller.activeTab?.url || "",
    desktopUnavailable: controller.desktopUnavailable,
    historyEntries: controller.historyEntries,
    bookmarkEntries: controller.bookmarkEntries,
    downloads: controller.downloads,
    diagnostics: controller.diagnostics,
    lobsterStatus,
    lobsterLabel,
    binding: controller.binding,
    connectionState: controller.connectionState,
    bindingSetupState: controller.bindingSetupState,
    gatewayStatus: controller.gatewayStatus,
    deviceStatus: controller.deviceStatus,
    pairingStatus: controller.pairingStatus,
    lastError: controller.lastError,
    approvingPairingRequestId: controller.approvingPairingRequestId,
    isApprovingLatestDevice: controller.isApprovingLatestDevice,
    pinnedSkillNames,
    hiddenSkillNames,
    skillCatalog: controller.skillCatalog,
    onTogglePinnedSkill: togglePinnedSkill,
    onToggleHiddenSkill: toggleHiddenSkill,
    onBeginBindingSetup: (target) => {
      void controller.beginBindingSetup(target);
    },
    onDisconnectOpenClaw: (target) => {
      void controller.disconnectOpenClaw({ target }).catch(() => {});
    },
    onCloseGenTab: controller.handleCloseGenTab,
    onApprovePairingRequest: (request) => {
      void controller.approvePairingRequest(request).catch(() => {});
    },
    onApproveLatestDeviceRequest: () => {
      void controller.approveLatestDeviceRequest().catch(() => {});
    },
    onNavigate: (url) => {
      void handleNavigate(url);
    },
    onRemoveBookmark: (url) => {
      void controller.removeBookmark(url);
    },
    onOpenDownload: (downloadId) => {
      void controller.openDownload(downloadId);
    },
    onRevealDownload: (downloadId) => {
      void controller.revealDownload(downloadId);
    },
    onRefreshDiagnostics: () => {
      void controller.refreshDiagnostics();
    },
    onOpenLogDirectory: () => {
      void controller.openLogDirectory();
    },
    onRevealHumanLogFile: () => {
      void controller.revealHumanLogFile();
    },
    onOpenDiagnostics: () => {
      void openInternalTab("diagnostics");
    },
    onOpenExternalUrl: (url) => {
      void controller.openExternalUrl(url);
    },
    onSelectBindingTarget: controller.setBindingTarget,
  };

  const sidebarPaneProps: ComponentProps<typeof AppSidebarPane> = {
    open: controller.sidebarOpen,
    surfaceMode,
    binding: controller.binding,
    chatKey: sidebarChatKey,
    composerText: controller.composerText,
    generatingGenTabId: controller.generatingGenTabId,
    hasConnectedLobster,
    isModelSwitching: controller.isModelSwitching,
    isThinking: controller.isThinking,
    lobsterLabel,
    lobsterStatus,
    modelSelectValue,
    models,
    onClearReferences: controller.clearSelectedReferences,
    onClearSelectedSkill: controller.clearSelectedComposerSkill,
    onClose: () => controller.setSidebarOpen(false),
    onChangeReferenceQuery: controller.setReferenceQuery,
    onComposerChange: controller.setComposerText,
    onOpenGenTabGenerator: controller.handleOpenGenTabGenerator,
    onOpenSkills: () => {
      void openInternalTab("skills");
    },
    onOpenSettings: () => {
      void openInternalTab("settings");
    },
    onResizeStart: handleResizeStart,
    onSelectModel: (modelId) => {
      void controller.setSelectedModel(modelId);
    },
    onSelectThread: controller.selectThread,
    onSend: () => {
      void handleChat();
    },
    onSendToOpenClaw: () => {
      void handleSendToOpenClaw();
    },
    onToggleReference: controller.toggleReference,
    quickActions: sidebarQuickActions,
    referenceCandidates: controller.referenceCandidates,
    referenceQuery: controller.referenceQuery,
    selectedComposerSkill: controller.selectedComposerSkill,
    selectedReferenceIds: controller.selectedReferenceIds,
    sidebarWidth,
    threadSummaries: controller.threadSummaries,
    visibleMessages,
  };

  return {
    browserChromeProps,
    newTabSurfaceProps,
    mainSurfaceProps,
    sidebarPaneProps,
    isDraggingState,
    isNewTabSurface,
    showBrowserFrame: surfaceMode === "browser",
  };
}
