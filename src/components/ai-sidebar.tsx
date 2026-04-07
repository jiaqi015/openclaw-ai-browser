import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, History, Sparkles, Swords, X } from "lucide-react";
import type {
  SabrinaTabReferenceCandidate,
  SabrinaThreadSummary,
} from "../application/sabrina-openclaw";
import type { GenTabPreferredType } from "../lib/gentab-types";
import { cn } from "../lib/utils";
import { ChatHistoryPanel } from "./chat-history-panel";
import { TabReferencePicker } from "./tab-reference-picker";
import { AiSidebarComposerCard } from "./ai-sidebar-composer-card";
import { AiSidebarGenTabLauncher } from "./ai-sidebar-gentab-launcher";
import { AiSidebarMessageList } from "./ai-sidebar-message-list";
import type {
  SidebarComposerSkill,
  SidebarMessage,
  SidebarModelOption,
  SidebarQuickAction,
} from "./ai-sidebar-types";
import { useUiPreferences } from "../application/use-ui-preferences";
import { translate } from "../../shared/localization.mjs";

export function AiSidebar(props: {
  binding: SabrinaOpenClawBinding | null;
  canGenerateGenTab: boolean;
  chatKey: string;
  composerText: string;
  genTabBlockedReason: string;
  hasConnectedLobster: boolean;
  isModelSwitching: boolean;
  isThinking: boolean;
  lobsterLabel: string;
  lobsterStatus: "connected" | "disconnected";
  modelSelectValue: string;
  models: SidebarModelOption[];
  onClearReferences: () => void;
  onClearSelectedSkill: () => void;
  onClose: () => void;
  onComposerChange: (value: string) => void;
  onChangeReferenceQuery: (value: string) => void;
  onOpenGenTabGenerator: (params: {
    userIntent: string;
    preferredType: GenTabPreferredType;
  }) => Promise<{
    success: boolean;
    error?: string;
  }>;
  onOpenSkills: () => void;
  onOpenSettings: () => void;
  onResizeStart: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onSelectModel: (modelId: string) => void;
  onSelectThread: (threadId: string) => void;
  onSend: () => void;
  onSendToOpenClaw: () => void;
  onToggleReference: (tabId: string) => void;
  primaryGenTabSourceTab: SabrinaTabReferenceCandidate | null;
  quickActions: SidebarQuickAction[];
  referenceCandidates: SabrinaTabReferenceCandidate[];
  referenceQuery: string;
  selectedComposerSkill: SidebarComposerSkill | null;
  selectedReferenceIds: string[];
  sidebarWidth: number;
  totalGenTabSourcePageCount: number;
  generatingGenTabId: string | null;
  threadSummaries: SabrinaThreadSummary[];
  visibleMessages: SidebarMessage[];
}) {
  const {
    binding,
    canGenerateGenTab,
    chatKey,
    composerText,
    genTabBlockedReason,
    hasConnectedLobster,
    isModelSwitching,
    isThinking,
    lobsterLabel,
    lobsterStatus,
    modelSelectValue,
    models,
    onClearReferences,
    onClearSelectedSkill,
    onClose,
    onChangeReferenceQuery,
    onComposerChange,
    onOpenGenTabGenerator,
    onOpenSkills,
    onOpenSettings,
    onResizeStart,
    onSelectModel,
    onSelectThread,
    onSend,
    onSendToOpenClaw,
    onToggleReference,
    primaryGenTabSourceTab,
    quickActions,
    referenceCandidates,
    referenceQuery,
    selectedComposerSkill,
    selectedReferenceIds,
    sidebarWidth,
    totalGenTabSourcePageCount,
    generatingGenTabId,
    threadSummaries,
    visibleMessages,
  } = props;
  const [panelMode, setPanelMode] = useState<"history" | "references" | null>(null);
  const {
    preferences: { uiLocale },
  } = useUiPreferences();
  const selectedReferenceTabs = useMemo(
    () => referenceCandidates.filter((tab) => selectedReferenceIds.includes(tab.id)),
    [referenceCandidates, selectedReferenceIds],
  );

  useEffect(() => {
    setPanelMode(null);
  }, [chatKey]);

  return (
    <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: sidebarWidth, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="surface-sidebar-shell surface-window-bar border-l border-white/5 flex flex-col h-full min-h-0 relative shrink-0"
    >
      <div
        onMouseDown={onResizeStart}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-white/10 active:bg-white/20 transition-colors z-50"
      />

      <div className="drag-region h-12 px-5 flex items-center justify-between border-b border-white/5 shrink-0">
        <div className="flex items-center">
          <h2 className="font-bold text-[13px] leading-none">Sabrina</h2>
        </div>

        <div className="no-drag flex items-center gap-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={cn("w-1.5 h-1.5 rounded-full", lobsterStatus === "connected" ? "bg-green-400 animate-pulse" : "bg-red-400")} />
            <span
              className="text-[10px] text-white/50 font-medium max-w-[140px] truncate"
              title={
                lobsterStatus === "connected"
                  ? `OpenClaw: ${lobsterLabel}`
                  : translate(uiLocale, "sidebar.openClawDisconnected")
              }
            >
              {lobsterStatus === "connected"
                ? `OpenClaw: ${lobsterLabel}`
                : translate(uiLocale, "sidebar.openClawDisconnected")}
            </span>
            {lobsterStatus === "connected" ? (
              <span className="text-[9px] px-1 py-0.5 rounded bg-white/10 text-white/60 leading-none">
                {binding?.mode === "remote"
                  ? translate(uiLocale, "sidebar.remote")
                  : translate(uiLocale, "sidebar.local")}
              </span>
            ) : null}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-full text-white/40 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="h-14 px-5 flex flex-col justify-center border-b border-white/5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-apple-pink" />
            <span className="text-[10px] font-bold text-apple-pink/90 uppercase tracking-widest">
              {translate(uiLocale, "sidebar.favoriteSkills")}
            </span>
          </div>
          <button
            onClick={onOpenSkills}
            className="group flex items-center gap-1 text-[10px] font-medium text-white/50 hover:text-white transition-colors"
          >
            <Swords className="w-3 h-3" />
            <span>{translate(uiLocale, "surface.skills")}</span>
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform -ml-0.5" />
          </button>
        </div>
        {quickActions.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-xs text-white/40">
            {translate(uiLocale, "sidebar.noQuickSkills")}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {quickActions.map((action) => (
              <SidebarActionButton
                key={action.id}
                active={action.active}
                icon={action.icon}
                label={action.label}
                disabled={action.disabled}
                onClick={action.onClick}
              />
            ))}
          </div>
        )}
      </div>

      <div className="px-5 py-2 border-b border-white/5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPanelMode((current) => (current === "history" ? null : "history"))}
            className={cn(
              "surface-pill inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition-colors",
              panelMode === "history" ? "surface-pill-active" : "text-white/58",
            )}
          >
            <History className="h-3.5 w-3.5" />
            {translate(uiLocale, "history.title")}
          </button>
        </div>

        {!hasConnectedLobster ? (
          <button
            onClick={onOpenSettings}
            className="text-[11px] font-medium text-white/60 hover:text-white transition-colors"
          >
            {translate(uiLocale, "sidebar.connect")}
          </button>
        ) : selectedReferenceIds.length > 0 ? (
          <span className="text-[11px] text-white/42">
            {translate(uiLocale, "sidebar.referencedCount", {
              count: selectedReferenceIds.length,
            })}
          </span>
        ) : (
          <span className="text-[11px] text-white/30">
            {translate(uiLocale, "sidebar.currentPageChat")}
          </span>
        )}
      </div>

      <AnimatePresence initial={false}>
        {panelMode === "history" ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 360 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-visible border-b border-white/5 pr-2 pl-5 py-3 flex flex-col min-h-0"
          >
            <ChatHistoryPanel
              threads={threadSummaries}
              onSelectThread={(threadId) => {
                onSelectThread(threadId);
                setPanelMode(null);
              }}
            />
          </motion.div>
        ) : null}
        {panelMode === "references" ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 360 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-visible border-b border-white/5 pr-2 pl-5 py-3 flex flex-col min-h-0"
          >
            <TabReferencePicker
              query={referenceQuery}
              selectedIds={selectedReferenceIds}
              tabs={referenceCandidates}
              onChangeQuery={onChangeReferenceQuery}
              onToggleTab={onToggleReference}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AiSidebarMessageList
        chatKey={chatKey}
        isThinking={isThinking}
        visibleMessages={visibleMessages}
      />

      <div className="shrink-0 px-5 pt-5 pb-3 border-t border-white/5 flex flex-col gap-3">
        <AiSidebarComposerCard
          composerText={composerText}
          genTabLauncher={
            <AiSidebarGenTabLauncher
              blockedReason={genTabBlockedReason}
              canGenerate={canGenerateGenTab}
              chatKey={chatKey}
              composerText={composerText}
              generatingGenTabId={generatingGenTabId}
              hasConnectedLobster={hasConnectedLobster}
              onOpenGenTabGenerator={onOpenGenTabGenerator}
              primarySourceTab={primaryGenTabSourceTab}
              selectedReferenceTabs={selectedReferenceTabs}
              totalSourcePageCount={totalGenTabSourcePageCount}
            />
          }
          hasConnectedLobster={hasConnectedLobster}
          isModelSwitching={isModelSwitching}
          isThinking={isThinking}
          modelSelectValue={modelSelectValue}
          models={models}
          onClearReferences={onClearReferences}
          onClearSelectedSkill={onClearSelectedSkill}
          onComposerChange={onComposerChange}
          onSelectModel={onSelectModel}
          onSend={onSend}
          onSendToOpenClaw={onSendToOpenClaw}
          onToggleReference={onToggleReference}
          onToggleReferencesPanel={() =>
            setPanelMode((current) => (current === "references" ? null : "references"))
          }
          referencesPanelOpen={panelMode === "references"}
          selectedComposerSkill={selectedComposerSkill}
          selectedReferenceIds={selectedReferenceIds}
          selectedReferenceTabs={selectedReferenceTabs}
        />
      </div>
    </motion.aside>
  );
}

function SidebarActionButton(props: {
  active?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      className={cn(
        "flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg transition-all border",
        props.active ? "surface-button-ai-soft" : "surface-button-system",
        props.disabled ? "opacity-20 cursor-not-allowed" : "text-white/70 hover:text-white",
      )}
    >
      {props.icon}
      <span className="text-[10px] font-medium whitespace-nowrap">{props.label}</span>
    </button>
  );
}
