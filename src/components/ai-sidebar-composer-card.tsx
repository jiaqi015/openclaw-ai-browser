import type { KeyboardEvent, ReactNode } from "react";
import { useState, useRef, useEffect } from "react";
import {
  ArrowUpRight,
  AtSign,
  Bot,
  ChevronDown,
  ChevronRight,
  Loader2,
  MessageSquare,
  Square,
  Sparkles,
  X,
} from "lucide-react";
import type { SabrinaTabReferenceCandidate } from "../application/sabrina-openclaw";
import { cn } from "../lib/utils";
import { LobsterHandoffIcon } from "./lobster-handoff-icon";
import type {
  SidebarComposerSkill,
  SidebarModelOption,
} from "./ai-sidebar-types";
import { useUiPreferences } from "../application/use-ui-preferences";
import { translate } from "../../shared/localization.mjs";

// ── Mode Definitions ────────────────────────────────────────────────────────
type SendMode = "chat" | "agent" | "claw";

interface ModeOption {
  id: SendMode;
  icon: ReactNode;
  label: string;
  sublabel: string;
  color: string;
  activeClass: string;
  dropdownBg: string;
}

const MODES: ModeOption[] = [
  {
    id: "chat",
    icon: <MessageSquare className="h-3.5 w-3.5" />,
    label: "Chat",
    sublabel: "快速对话",
    color: "text-white/70",
    activeClass: "border-white/20 bg-white/8",
    dropdownBg: "bg-white/10",
  },
  {
    id: "agent",
    icon: <Bot className="h-3.5 w-3.5" />,
    label: "Agent",
    sublabel: "自动操作页面",
    color: "text-[#FF2D55]",
    activeClass: "border-[#FF2D55]/30 bg-[#FF2D55]/8",
    dropdownBg: "bg-[#FF2D55]/15",
  },
  {
    id: "claw",
    icon: <LobsterHandoffIcon className="h-3.5 w-3.5" />,
    label: "Claw",
    sublabel: "后台深度分析",
    color: "text-violet-400",
    activeClass: "border-violet-400/30 bg-violet-400/8",
    dropdownBg: "bg-violet-400/15",
  },
];

// ── Component ────────────────────────────────────────────────────────────────
export function AiSidebarComposerCard(props: {
  composerText: string;
  genTabLauncher?: ReactNode;
  hasConnectedLobster: boolean;
  isModelSwitching: boolean;
  isThinking: boolean;
  modelSelectValue: string;
  models: SidebarModelOption[];
  onClearReferences: () => void;
  onClearSelectedSkill: () => void;
  onComposerChange: (value: string) => void;
  onSelectModel: (modelId: string) => void;
  onSend: () => void;
  onSendToOpenClaw: () => void;
  onRunAgent: () => void;
  onStopTurn: () => void;
  onToggleReference: (tabId: string) => void;
  onToggleReferencesPanel: () => void;
  referencesPanelOpen: boolean;
  selectedComposerSkill: SidebarComposerSkill | null;
  selectedReferenceIds: string[];
  selectedReferenceTabs: SabrinaTabReferenceCandidate[];
}) {
  const {
    composerText,
    genTabLauncher,
    hasConnectedLobster,
    isModelSwitching,
    isThinking,
    modelSelectValue,
    models,
    onClearReferences,
    onClearSelectedSkill,
    onComposerChange,
    onSelectModel,
    onSend,
    onSendToOpenClaw,
    onRunAgent,
    onStopTurn,
    onToggleReference,
    onToggleReferencesPanel,
    referencesPanelOpen,
    selectedComposerSkill,
    selectedReferenceIds,
    selectedReferenceTabs,
  } = props;

  const {
    preferences: { uiLocale },
  } = useUiPreferences();

  const [sendMode, setSendMode] = useState<SendMode>("chat");
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentMode = MODES.find((mode) => mode.id === sendMode) ?? MODES[0];

  const canSend =
    hasConnectedLobster &&
    !isThinking &&
    !isModelSwitching &&
    (!!composerText.trim() || !!selectedComposerSkill);
  
  const canStop = isThinking;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setModeDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSend() {
    if (sendMode === "chat") {
      onSend();
    } else if (sendMode === "agent") {
      onRunAgent();
    } else if (sendMode === "claw") {
      onSendToOpenClaw();
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !isModelSwitching) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      className={cn(
        "surface-panel rounded-2xl border p-3 flex flex-col gap-3 transition-all duration-300",
        sendMode === "agent" && "border-[#FF2D55]/20",
        sendMode === "claw" && "border-violet-400/20",
      )}
    >
      {/* ── References row ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={onToggleReferencesPanel}
          className={cn(
            "surface-pill inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-medium transition-colors",
            referencesPanelOpen ? "surface-pill-active" : "text-white/50",
          )}
        >
          <AtSign className="h-3 w-3" />
          {translate(uiLocale, "sidebar.references")}
          {selectedReferenceIds.length > 0 ? (
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] text-white/60">
              {selectedReferenceIds.length}
            </span>
          ) : null}
        </button>

        <div className="flex items-center gap-2">
          {selectedReferenceIds.length > 0 ? (
            <button
              onClick={onClearReferences}
              className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
            >
              {translate(uiLocale, "sidebar.clearReferences")}
            </button>
          ) : null}
          {genTabLauncher}
        </div>
      </div>

      {selectedReferenceTabs.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {selectedReferenceTabs.map((tab) => (
            <span
              key={tab.id}
              className="surface-chip inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] text-white/68"
            >
              <AtSign className="h-3 w-3" />
              <span className="max-w-[120px] truncate">{tab.title}</span>
              <button
                onClick={() => onToggleReference(tab.id)}
                className="ml-0.5 hover:text-white transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {selectedComposerSkill ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="surface-chip-ai inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]">
            <Sparkles className="h-3 w-3" />
            <span className="max-w-[160px] truncate">{selectedComposerSkill.label}</span>
            <button
              onClick={onClearSelectedSkill}
              className="ml-0.5 hover:text-white transition-colors"
              aria-label={translate(uiLocale, "sidebar.removeSkill")}
              title={translate(uiLocale, "sidebar.removeSkill")}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        </div>
      ) : null}

      {/* genTabLauncher relocated to top row */}

      {/* ── Agent mode banner ── */}
      {sendMode === "agent" && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#FF2D55]/8 border border-[#FF2D55]/15">
          <div className="w-1.5 h-1.5 rounded-full bg-[#FF2D55] animate-pulse shadow-[0_0_6px_#FF2D55]" />
          <span className="text-[10px] text-[#FF2D55]/80 font-medium">
            Agent 模式 · 将自动操控当前页面
          </span>
        </div>
      )}

      {sendMode === "claw" && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-violet-400/8 border border-violet-400/15">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse shadow-[0_0_6px_rgba(167,139,250,0.8)]" />
          <span className="text-[10px] text-violet-400/80 font-medium">
            Claw 模式 · 将发送到 OpenClaw 后台处理
          </span>
        </div>
      )}

      {/* ── Textarea ── */}
      <textarea
        placeholder={
          sendMode === "agent"
            ? "告诉 Agent 要在页面上完成什么任务..."
            : sendMode === "claw"
            ? "发送给 Claw 深度分析..."
            : translate(uiLocale, "sidebar.sendMessage")
        }
        value={composerText}
        onChange={(event) => onComposerChange(event.target.value)}
        onKeyDown={handleComposerKeyDown}
        className="w-full bg-transparent text-sm focus:outline-none resize-none min-h-[60px] max-h-[200px] placeholder:text-white/40 no-scrollbar"
        rows={2}
      />

      {/* ── Bottom toolbar ── */}
      <div className="flex items-center justify-between">
        {/* Left: model selector */}
        <div className="flex items-center gap-2">
          <div className="relative group">
            <select
              value={modelSelectValue}
              onChange={(event) => onSelectModel(event.target.value)}
              disabled={!hasConnectedLobster || isModelSwitching}
              className="surface-button-system h-8 w-[128px] max-w-[128px] rounded-lg border pl-3 pr-8 text-[11px] font-medium appearance-none focus:outline-none cursor-pointer transition-all text-white/80 disabled:opacity-60 disabled:cursor-wait"
            >
              {models.map((model) => (
                <option key={model.id} value={model.id} className="bg-[#1a1a1a] text-white">
                  {model.label}
                </option>
              ))}
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-white/40">
              <ChevronRight className="w-3 h-3 rotate-90" />
            </div>
          </div>
          {isModelSwitching ? (
            <div className="flex items-center gap-1.5 text-[11px] text-white/45">
              <Loader2 className="w-3 h-3 animate-spin" />
              {translate(uiLocale, "sidebar.switchingModel")}
            </div>
          ) : null}
        </div>

        {/* Right: Mode Selector + Send */}
        <div className="flex items-center gap-2">
          {/* ── Mode Dropdown Selector ── */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setModeDropdownOpen((v) => !v)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold transition-all duration-200",
                currentMode.activeClass,
                currentMode.color,
              )}
              title="切换发送模式"
            >
              {currentMode.icon}
              <span>{currentMode.label}</span>
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform duration-200 opacity-60",
                  modeDropdownOpen && "rotate-180",
                )}
              />
            </button>

            {/* Dropdown menu */}
            {modeDropdownOpen && (
              <div className="absolute bottom-full right-0 mb-1.5 w-44 rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                {MODES.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => {
                      setSendMode(mode.id);
                      setModeDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/5",
                      sendMode === mode.id && mode.dropdownBg,
                    )}
                  >
                    <div className={cn("shrink-0", mode.color)}>{mode.icon}</div>
                    <div className="flex flex-col min-w-0">
                      <span className={cn("text-[12px] font-semibold", mode.color)}>
                        {mode.label}
                      </span>
                      <span className="text-[10px] text-white/40 truncate">{mode.sublabel}</span>
                    </div>
                    {sendMode === mode.id && (
                      <div className={cn("ml-auto w-1.5 h-1.5 rounded-full shrink-0", 
                        mode.id === "agent" ? "bg-[#FF2D55]" :
                        mode.id === "claw" ? "bg-violet-400" : "bg-white/60"
                      )} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Send Button ── */}
          <button
            id="composer-send-button"
            disabled={
              (!isThinking && isModelSwitching) ||
              (!isThinking && !composerText.trim() && !selectedComposerSkill) ||
              (!isThinking && sendMode !== "chat" && !hasConnectedLobster)
            }
            aria-label={isThinking ? translate(uiLocale, "agent.stopTask") : translate(uiLocale, "sidebar.sendMessage")}
            title={isThinking ? translate(uiLocale, "agent.stopTask") : translate(uiLocale, "sidebar.sendMessage")}
            onClick={(e) => {
              if (isThinking) {
                e.preventDefault();
                onStopTurn();
              } else {
                handleSend();
              }
            }}
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed hover:scale-105",
              isThinking 
                ? "bg-zinc-700 hover:bg-zinc-600 shadow-[0_2px_12px_rgba(255,255,255,0.1)]"
                : sendMode === "agent"
                ? "bg-[#FF2D55] hover:bg-[#ff4d6d] shadow-[0_2px_12px_rgba(255,45,85,0.35)]"
                : sendMode === "claw"
                ? "bg-violet-500 hover:bg-violet-400 shadow-[0_2px_12px_rgba(139,92,246,0.35)]"
                : "surface-button-ai",
            )}
          >
            {isThinking ? (
              <Square className="w-3 h-3 text-white fill-white" />
            ) : isModelSwitching ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <ArrowUpRight className="w-4 h-4 text-white" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
