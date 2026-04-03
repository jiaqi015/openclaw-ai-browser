export type SabrinaChatMessage = SabrinaChatMessageRecord;

export function createChatMessageId() {
  return `msg-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildWelcomeMessage(tab: SabrinaDesktopTab): SabrinaChatMessage {
  return {
    messageId: createChatMessageId(),
    role: "system",
    text: [
      "### Sabrina 已接入真实网页",
      `- 当前标签页：**${tab.title || "新标签页"}**`,
      "- 右侧可以直接总结网页、提取要点，或者基于当前页面继续追问。",
      "- 如果你先在网页里划词，AI 会优先使用选中的文本作为上下文。",
    ].join("\n"),
  };
}

export function normalizeChatError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "请求失败了，请稍后再试。";
}
