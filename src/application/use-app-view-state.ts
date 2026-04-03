import { useMemo } from "react";
import type {
  SidebarComposerSkill,
  SidebarMessage,
  SidebarModelOption,
  SidebarQuickAction,
} from "../components/ai-sidebar-types";

export function useAppViewState(params: {
  activeMessages: SabrinaChatMessageRecord[];
  activeTab: SabrinaDesktopTab | null;
  activeThreadId: string | null;
  binding: SabrinaOpenClawBinding | null;
  connectionState: SabrinaOpenClawConnectionState | null;
  clearSelectedComposerSkill: () => void;
  composerText: string;
  hiddenSkillNames: string[];
  isModelSwitching: boolean;
  isThinking: boolean;
  modelOptions: SabrinaOpenClawModelOption[];
  pinnedSkillNames: string[];
  selectedComposerSkill: SidebarComposerSkill | null;
  selectedModel: string | null;
  sendMessage: (overridePrompt?: string) => Promise<void>;
  sendToOpenClaw: (overridePrompt?: string) => Promise<void>;
  setSelectedComposerSkill: (skill: SidebarComposerSkill) => void;
  skillCatalog: SabrinaOpenClawSkillCatalog | null;
  surfaceMode: string;
  toggleBookmark: () => void;
}) {
  const {
    activeMessages,
    activeTab,
    activeThreadId,
    binding,
    connectionState,
    clearSelectedComposerSkill,
    composerText,
    hiddenSkillNames,
    isModelSwitching,
    isThinking,
    modelOptions,
    pinnedSkillNames,
    selectedComposerSkill,
    selectedModel,
    sendMessage,
    sendToOpenClaw,
    setSelectedComposerSkill,
    skillCatalog,
    surfaceMode,
    toggleBookmark,
  } = params;
  const lobsterStatus: "connected" | "disconnected" =
    connectionState?.status === "connected" || binding?.status === "active"
      ? "connected"
      : "disconnected";
  const hasConnectedLobster = lobsterStatus === "connected";
  const lobsterLabel =
    connectionState?.summary ||
    binding?.displayName ||
    binding?.hostLabel ||
    "jiaqi-mac";
  const bookmarkableUrl =
    surfaceMode === "browser" && activeTab?.url && activeTab.url !== "about:blank"
      ? activeTab.url
      : null;

  const models = useMemo<SidebarModelOption[]>(() => {
    if (!hasConnectedLobster) {
      return [{ id: "__no-model__", label: "暂无模型", desc: "请先连接龙虾" }];
    }

    const normalized = modelOptions.map((model) => ({
      id: model.id,
      label: model.label,
      desc: model.desc,
    }));

    if (normalized.length === 0) {
      return [{ id: "__no-model__", label: "同步模型中", desc: "正在读取龙虾可用模型" }];
    }

    if (!selectedModel) {
      return [
        { id: "__no-model__", label: "同步模型中", desc: "正在等待龙虾确认当前模型" },
        ...normalized,
      ];
    }

    if (normalized.some((model) => model.id === selectedModel)) {
      return normalized;
    }

    return [
      { id: selectedModel, label: selectedModel, desc: "当前已选模型" },
      ...normalized,
    ];
  }, [hasConnectedLobster, modelOptions, selectedModel]);

  const visibleMessages = useMemo<SidebarMessage[]>(
    () => activeMessages.filter((message) => message.role !== "system"),
    [activeMessages],
  );

  const sidebarQuickActions = useMemo<SidebarQuickAction[]>(
    () =>
      pinnedSkillNames
        .filter((skillName) => !hiddenSkillNames.includes(skillName))
        .map<SidebarQuickAction | null>((skillName) => {
          const skill = skillCatalog?.skills.find((entry) => entry.name === skillName);
          if (!skill) {
            return null;
          }

          return {
            id: skill.name,
            icon: null,
            label: skill.displayName || skill.name,
            active: selectedComposerSkill?.name === skill.name,
            disabled:
              isThinking ||
              isModelSwitching ||
              !activeTab ||
              !activeThreadId ||
              !skill.ready,
            onClick: () => {
              if (!skill.ready) {
                return;
              }

              if (selectedComposerSkill?.name === skill.name) {
                clearSelectedComposerSkill();
                return;
              }

              setSelectedComposerSkill({
                name: skill.name,
                label: skill.displayName || skill.name,
              });
            },
          };
        })
        .filter((action): action is SidebarQuickAction => action !== null)
        .slice(0, 3),
    [
      activeTab,
      activeThreadId,
      clearSelectedComposerSkill,
      hiddenSkillNames,
      isModelSwitching,
      isThinking,
      pinnedSkillNames,
      selectedComposerSkill,
      setSelectedComposerSkill,
      skillCatalog,
    ],
  );

  async function handleBookmarkToggle() {
    if (!bookmarkableUrl) {
      return;
    }

    toggleBookmark();
  }

  async function handleChat(overrideText?: string) {
    if (isModelSwitching) {
      return;
    }

    const textToUse = (overrideText ?? composerText).trim();
    if (!textToUse && !selectedComposerSkill) {
      return;
    }

    await sendMessage(textToUse);
  }

  async function handleSendToOpenClaw(overrideText?: string) {
    if (isModelSwitching) {
      return;
    }

    await sendToOpenClaw(overrideText);
  }

  return {
    handleBookmarkToggle,
    handleChat,
    handleSendToOpenClaw,
    hasConnectedLobster,
    lobsterLabel,
    lobsterStatus,
    modelSelectValue:
      hasConnectedLobster && selectedModel ? selectedModel : "__no-model__",
    models,
    sidebarChatKey: activeThreadId ?? activeTab?.tabId ?? "sabrina-chat",
    sidebarQuickActions,
    visibleMessages,
  };
}
