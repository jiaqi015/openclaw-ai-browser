export function buildBrowserAiPrompt({
  action,
  prompt,
  contextPackage = null,
  context = null,
  attachments = [],
  primaryMemory = null,
}) {
  const primaryContext = contextPackage?.primary ?? context ?? null;
  const references = Array.isArray(contextPackage?.references)
    ? contextPackage.references
    : attachments;
  const actionInstruction =
    action === "summarize"
      ? "请总结当前网页，先给出一段总览，再补充 3 到 5 个关键信息点。"
      : action === "key-points"
        ? "请提取当前网页的核心要点，使用简洁的 Markdown 列表输出。"
        : action === "explain-selection"
          ? "请优先解释用户选中的文本，必要时结合整页上下文补充说明。"
          : "请基于当前网页回答用户的问题。如果页面信息不足，请明确说明不足之处。";

  const headingBlock = Array.isArray(primaryContext?.headings) && primaryContext.headings.length
    ? `页面标题结构：\n${primaryContext.headings.map((heading) => `- ${heading}`).join("\n")}`
    : "";
  const sectionBlock = Array.isArray(primaryContext?.sections) && primaryContext.sections.length
    ? `页面重点分段：\n${primaryContext.sections
        .map((section) => `- ${section.title}: ${section.summary}`)
        .join("\n")}`
    : "";
  const descriptionBlock = primaryContext?.metadata?.description
    ? `页面描述：${primaryContext.metadata.description}`
    : "";
  const attachmentBlocks = references
    .filter((attachment) => attachment?.context)
    .map((attachment, index) => {
      const entryContext = attachment.context;
      const entryHeadingBlock = entryContext.headings.length
        ? `标题结构：\n${entryContext.headings.map((heading) => `- ${heading}`).join("\n")}`
        : "";
      const entrySectionBlock = entryContext.sections.length
        ? `重点分段：\n${entryContext.sections
            .map((section) => `- ${section.title}: ${section.summary}`)
            .join("\n")}`
        : "";

      return [
        `引用页面 ${index + 1}：${entryContext.title}`,
        `引用 URL：${entryContext.url}`,
        entryContext.selectedText
          ? `引用页选中文本：\n${entryContext.selectedText}`
          : "",
        entryHeadingBlock,
        entrySectionBlock,
        `引用页正文：\n${entryContext.contentText || "当前引用页暂无可提取正文。"}`,
      ]
        .filter(Boolean)
        .join("\n\n");
    });

  const memoryBlock = primaryMemory
    ? `用户背景（来自 OpenClaw 主 agent 记忆，仅供参考，不要照搬）：\n${primaryMemory}`
    : null;

  return [
    "你是一个内置在桌面浏览器里的 AI 助手。请始终使用中文回答，并保持简洁、可靠。",
    actionInstruction,
    memoryBlock,
    `页面标题：${primaryContext?.title || "当前页面"}`,
    `页面 URL：${primaryContext?.url || ""}`,
    primaryContext?.selectedText
      ? `用户当前选中的文本（最高优先级）：\n${primaryContext.selectedText}`
      : "用户当前没有选中文本，请以清洗后的页面正文作为主要上下文。",
    descriptionBlock,
    headingBlock,
    sectionBlock,
    `清洗后的页面正文（主上下文）：\n${primaryContext?.contentText || "当前页面暂无可提取正文。"}`,
    attachmentBlocks.length
      ? `本轮额外引用了 ${attachmentBlocks.length} 个页面，请一并纳入判断：\n\n${attachmentBlocks.join("\n\n---\n\n")}`
      : "",
    prompt ? `用户请求：\n${prompt}` : "",
    "请使用 Markdown 输出，避免编造页面中不存在的事实。",
  ]
    .filter(Boolean)
    .join("\n\n");
}
