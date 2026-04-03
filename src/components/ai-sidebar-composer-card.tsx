import type { KeyboardEvent, ReactNode } from "react";
import { ArrowUpRight, AtSign, ChevronRight, Loader2, Sparkles, X } from "lucide-react";
import type { SabrinaTabReferenceCandidate } from "../application/sabrina-openclaw";
import { cn } from "../lib/utils";
import { LobsterHandoffIcon } from "./lobster-handoff-icon";
import type {
  SidebarComposerSkill,
  SidebarModelOption,
} from "./ai-sidebar-types";
import { useUiPreferences } from "../application/use-ui-preferences";
import { translate } from "../../shared/localization.mjs";

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
  const canSendToBackground =
    hasConnectedLobster && !isThinking && !isModelSwitching && !selectedComposerSkill;

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !isModelSwitching) {
      event.preventDefault();
      onSend();
    }
  }

  return (
    <div className="surface-panel rounded-2xl border p-3 flex flex-col gap-3 transition-all">
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

        {selectedReferenceIds.length > 0 ? (
          <button
            onClick={onClearReferences}
            className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
          >
            {translate(uiLocale, "sidebar.clearReferences")}
          </button>
        ) : null}
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

      {genTabLauncher}

      <textarea
        placeholder={translate(uiLocale, "sidebar.sendMessage")}
        value={composerText}
        onChange={(event) => onComposerChange(event.target.value)}
        onKeyDown={handleComposerKeyDown}
        className="w-full bg-transparent text-sm focus:outline-none resize-none min-h-[60px] max-h-[200px] placeholder:text-white/40 no-scrollbar"
        rows={2}
      />

      <div className="flex items-center justify-between">
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSendToOpenClaw}
            disabled={!canSendToBackground}
            aria-label={
              selectedComposerSkill
                ? translate(uiLocale, "sidebar.skillSelectedSend")
                : translate(uiLocale, "sidebar.sendToOpenClaw")
            }
            title={
              selectedComposerSkill
                ? translate(uiLocale, "sidebar.skillSelectedSend")
                : translate(uiLocale, "sidebar.sendToOpenClaw")
            }
            className="surface-button-system inline-flex h-8 w-8 items-center justify-center rounded-lg border text-white/62 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            <LobsterHandoffIcon className="h-4 w-4" />
          </button>
          <button
            onClick={onSend}
            disabled={isThinking || isModelSwitching || (!composerText.trim() && !selectedComposerSkill)}
            className="surface-button-ai w-8 h-8 rounded-lg flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
          >
            {isThinking || isModelSwitching ? (
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
