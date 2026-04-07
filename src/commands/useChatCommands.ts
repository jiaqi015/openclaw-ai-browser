import {
  createChatMessageId,
  normalizeChatError,
  type SabrinaChatMessage,
} from "../application/sabrina-chat";
import type { SabrinaComposerSkill } from "../state/useThreadComposerState";
import {
  translate,
  type AssistantLocaleMode,
  type UiLocale,
} from "../../shared/localization.mjs";

type SabrinaDesktop = NonNullable<Window["sabrinaDesktop"]>;

function getOpenClawSessionId(threadId: string) {
  return `sabrina-thread:${threadId}`;
}

export function useChatCommands(params: {
  desktop?: SabrinaDesktop;
  activeTab: SabrinaDesktopTab | null;
  activeThreadId: string | null;
  binding: SabrinaOpenClawBinding | null;
  uiLocale: UiLocale;
  selectedModel: string;
  isModelSwitching: boolean;
  composerText: string;
  selectedReferenceIds: string[];
  selectedComposerSkill: SabrinaComposerSkill | null;
  appendMessage: (threadId: string, message: SabrinaChatMessage) => Promise<void>;
  clearSelectedReferences: (threadId?: string | null) => void;
  clearSelectedComposerSkill: (threadId?: string | null) => void;
  setComposerText: (value: string) => void;
  setPending: (threadId: string, pending: boolean) => void;
  switchSelectedModel: (modelId: string) => Promise<void>;
}) {
  const {
    activeTab,
    activeThreadId,
    appendMessage,
    binding,
    clearSelectedReferences,
    clearSelectedComposerSkill,
    composerText,
    desktop,
    isModelSwitching,
    uiLocale,
    selectedModel,
    selectedComposerSkill,
    selectedReferenceIds,
    setComposerText,
    setPending,
    switchSelectedModel,
  } = params;

  function appendInlineError(message: string) {
    if (!activeThreadId) {
      console.warn(`[Sabrina] ${message}`);
      return;
    }

    void appendMessage(activeThreadId, {
      messageId: createChatMessageId(),
      role: "error",
      text: message,
    });
  }

  async function setSelectedModel(modelId: string) {
    const normalizedModelId = modelId.trim();
    if (!normalizedModelId) {
      return;
    }

    try {
      await switchSelectedModel(normalizedModelId);
    } catch (error) {
      if (activeThreadId) {
        await appendMessage(activeThreadId, {
          messageId: createChatMessageId(),
          role: "error",
          text: normalizeChatError(error),
        });
      }
    }
  }

  async function executeAiAction(params: {
    action: "summarize" | "key-points" | "explain-selection" | "ask";
    userText: string;
    prompt?: string;
    skillName?: string;
    skillMode?: "strict" | "assist";
    clearComposer?: boolean;
    clearSelectedSkill?: boolean;
  }) {
    if (!desktop) {
      appendInlineError(translate(uiLocale, "error.desktopNotReady"));
      return;
    }
    if (!desktop.threads?.runAiTurn) {
      appendInlineError(translate(uiLocale, "error.aiTurnUnavailable"));
      return;
    }

    if (!activeTab) {
      appendInlineError(translate(uiLocale, "error.noUsableTab"));
      return;
    }

    if (!activeThreadId) {
      appendInlineError(translate(uiLocale, "error.threadNotReady"));
      return;
    }

    if (isModelSwitching) {
      appendInlineError(translate(uiLocale, "error.modelSwitchInProgress"));
      return;
    }

    if (!selectedModel) {
      appendInlineError(translate(uiLocale, "error.noSyncedModel"));
      return;
    }

    const requestTabId = activeTab.tabId;
    const requestThreadId = activeThreadId;

    if (params.clearComposer) {
      setComposerText("");
    }

    setPending(requestThreadId, true);

    try {
      const result = await desktop.threads.runAiTurn({
        threadId: requestThreadId,
        userText: params.userText,
        referenceTabIds: selectedReferenceIds,
        actionPayload: {
          action: params.action,
          agentId: binding?.agentId,
          model: selectedModel,
          prompt: params.prompt,
            skillName: params.skillName,
            skillMode: params.skillMode,
            sessionId: getOpenClawSessionId(requestThreadId),
            tabId: requestTabId,
            uiLocale,
            assistantLocaleMode: "follow-ui" as AssistantLocaleMode,
          },
        });

      if (result.ok) {
        if (params.clearSelectedSkill) {
          clearSelectedComposerSkill(requestThreadId);
        }
        clearSelectedReferences(requestThreadId);
      }
    } catch (error) {
      await appendMessage(requestThreadId, {
        messageId: createChatMessageId(),
        role: "error",
        text: normalizeChatError(error),
      });
    } finally {
      setPending(requestThreadId, false);
    }
  }

  async function sendMessage(overridePrompt?: string) {
    const prompt = (overridePrompt ?? composerText).trim();
    if (!prompt && !selectedComposerSkill) {
      return;
    }

    if (selectedComposerSkill) {
      const fallbackPrompt = `请使用技能 ${selectedComposerSkill.name} 处理当前网页内容。`;
      const userText = prompt
        ? `使用技能 ${selectedComposerSkill.label}\n\n${prompt}`
        : `使用技能 ${selectedComposerSkill.label}`;

      await executeAiAction({
        action: "ask",
        userText,
        prompt: prompt || fallbackPrompt,
        skillName: selectedComposerSkill.name,
        skillMode: "strict",
        clearComposer: true,
        clearSelectedSkill: true,
      });
      return;
    }

    await executeAiAction({
      action: "ask",
      userText: prompt,
      prompt,
      clearComposer: true,
    });
  }

  async function sendToOpenClaw(overridePrompt?: string) {
    const prompt = (overridePrompt ?? composerText).trim();
    if (
      !desktop ||
      !desktop.threads?.runOpenClawTaskTurn ||
      !activeTab ||
      !activeThreadId ||
      !binding ||
      isModelSwitching
    ) {
      return;
    }

    if (!overridePrompt) {
      setComposerText("");
    }

    setPending(activeThreadId, true);

    try {
      const result = await desktop.threads.runOpenClawTaskTurn({
        threadId: activeThreadId,
        userText: prompt || "请用龙虾异步处理当前页面任务。",
        referenceTabIds: selectedReferenceIds,
        taskPayload: {
          agentId: binding.agentId,
          tabId: activeTab.tabId,
          prompt,
          sessionId: getOpenClawSessionId(`${activeThreadId}:openclaw`),
          thinking: "low",
          uiLocale,
          assistantLocaleMode: "follow-ui" as AssistantLocaleMode,
        },
      });

      if (result.ok) {
        clearSelectedReferences(activeThreadId);
      }
    } catch (error) {
      await appendMessage(activeThreadId, {
        messageId: createChatMessageId(),
        role: "error",
        text: normalizeChatError(error),
      });
    } finally {
      setPending(activeThreadId, false);
    }
  }

  return {
    setSelectedModel,
    sendMessage,
    sendToOpenClaw,
  };
}
