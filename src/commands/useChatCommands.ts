import {
  createChatMessageId,
  normalizeChatError,
  type SabrinaChatMessage,
} from "../application/sabrina-chat";
import type { SabrinaComposerSkill } from "../state/useThreadComposerState";

type SabrinaDesktop = NonNullable<Window["sabrinaDesktop"]>;

function getOpenClawSessionId(threadId: string) {
  return `sabrina-thread:${threadId}`;
}

export function useChatCommands(params: {
  desktop?: SabrinaDesktop;
  activeTab: SabrinaDesktopTab | null;
  activeThreadId: string | null;
  binding: SabrinaOpenClawBinding | null;
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
      appendInlineError("桌面能力暂未就绪，请稍后再试。");
      return;
    }
    if (!desktop.threads?.runAiTurn) {
      appendInlineError("线程运行时暂未就绪，请稍后再试。");
      return;
    }

    if (!activeTab) {
      appendInlineError("当前没有可用标签页，暂时无法执行这个技能。");
      return;
    }

    if (!activeThreadId) {
      appendInlineError("当前对话线程还没准备好，请稍后再试。");
      return;
    }

    if (isModelSwitching) {
      appendInlineError("正在切换模型，请稍后再试。");
      return;
    }

    if (!selectedModel) {
      appendInlineError("当前还没有同步到可用模型，请稍后再试。");
      return;
    }

    const requestTabId = activeTab.tabId;
    const requestThreadId = activeThreadId;

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
        },
      });

      if (result.ok) {
        if (params.clearComposer) {
          setComposerText("");
        }
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

    setPending(activeThreadId, true);
    if (!overridePrompt) {
      setComposerText("");
    }

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
