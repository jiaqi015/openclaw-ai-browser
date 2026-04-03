export function buildBrowserSkillPrompt({
  action,
  prompt,
  contextPackage = null,
  context = null,
  attachments = [],
  skill,
  inputPlan,
  requestId,
}) {
  const primaryContext = contextPackage?.primary ?? context ?? null;
  const references = Array.isArray(contextPackage?.references)
    ? contextPackage.references
    : attachments;
  const actionInstruction =
    action === "summarize"
      ? "请使用该 skill 对当前网页做高质量总结，先给结论，再给关键信息点。"
      : action === "key-points"
        ? "请使用该 skill 抽取当前网页的核心要点，输出简洁列表。"
        : action === "explain-selection"
          ? "请优先围绕用户选中的文本工作，必要时结合整页上下文。"
          : "请优先用该 skill 完成用户请求；如果 skill 处理范围不足，再结合页面快照补充。";

  const attachmentBlock = references
    .filter((attachment) => attachment?.context)
    .map((attachment, index) => {
      const entryContext = attachment.context;
      return [
        `引用页面 ${index + 1}：${entryContext.title}`,
        `引用 URL：${entryContext.url}`,
        entryContext.selectedText ? `引用页选中文本：\n${entryContext.selectedText}` : "",
        `引用页摘要：\n${entryContext.leadText || entryContext.contentPreview || "暂无摘要。"}`,
      ]
        .filter(Boolean)
        .join("\n\n");
    })
    .join("\n\n---\n\n");

  const primaryInputBlock =
    inputPlan?.inputMode === "source-url"
      ? [
          inputPlan?.sourceRoute === "local-file"
            ? "该 skill 的主输入材料：当前本地文件路径"
            : "该 skill 的主输入材料：当前页面 URL",
          inputPlan?.sourceRouteLabel ? `当前 URL 路由：${inputPlan.sourceRouteLabel}` : "",
          inputPlan?.sourceFilePath
            ? `执行 /${skill.name} 时，请把这个本地文件路径作为实际输入：${inputPlan.sourceFilePath}`
            : "",
          !inputPlan?.sourceFilePath && inputPlan?.sourceUrl
            ? `执行 /${skill.name} 时，请把这个 URL 作为实际输入：${inputPlan.sourceUrl}`
            : "",
          inputPlan?.routeNote || "",
          "页面摘要和正文快照是 Sabrina 提供的浏览器上下文，用来帮助你校验结果、理解当前页面现场；不要把它们伪装成该 skill 的原始输入。",
          "如果 URL 抓取失败、本地文件读取失败、返回登录墙、或你确认该 skill 不能直接处理这个页面，请输出 [SKILL_FAILED] 并说明原因，不要伪造 skill 成功。",
        ]
          .filter(Boolean)
          .join("\n")
      : [
          "默认优先使用上面的选中文本、页面摘要和正文快照作为 skill 输入材料。",
          "只有当 skill 天生就需要 URL / 文件路径，并且你确认这样更合适时，才使用来源 URL。",
          "不要为了省事重新抓取网页来替代 Sabrina 已经提供的上下文。",
          "如果 skill 无法直接消费这些材料，请先说明失败原因并输出 [SKILL_FAILED]，不要跳过 skill 直接自由作答。",
        ].join("\n");

  return [
    "你正在 Sabrina 浏览器里处理一个网页相关任务。",
    "边界约束：Sabrina 浏览器已经负责整理网页上下文；你本轮不要改写任务边界，只需要执行指定 skill 并基于结果回答。",
    `本轮必须显式调用 OpenClaw skill "${skill.name}"。`,
    requestId ? `本轮请求编号：${requestId}` : "",
    `调用格式要求：先执行 /${skill.name}，拿到技能结果后再组织最终回复。`,
    skill.description ? `Skill 说明：${skill.description}` : "",
    actionInstruction,
    `当前页面标题：${primaryContext?.title || "当前页面"}`,
    inputPlan?.inputMode === "source-url"
      ? `当前页面来源 URL（这类 skill 的主输入）：${primaryContext?.url || ""}`
      : `当前页面来源 URL（仅供引用，不要默认重新抓取）：${primaryContext?.url || ""}`,
    primaryContext?.selectedText ? `用户选中文本：\n${primaryContext.selectedText}` : "",
    `页面摘要：\n${primaryContext?.leadText || primaryContext?.contentPreview || "当前页面暂无摘要。"}`,
    `页面正文快照：\n${primaryContext?.contentText || "当前页面暂无可提取正文。"}`,
    attachmentBlock ? `额外引用页面：\n\n${attachmentBlock}` : "",
    prompt ? `用户目标：\n${prompt}` : "",
    primaryInputBlock,
    "输出协议（必须遵守）：",
    requestId
      ? `第一行只能输出 [SKILL_USED:${skill.name}:${requestId}] 或 [SKILL_FAILED:${skill.name}:${requestId}] <原因>`
      : `第一行只能输出 [SKILL_USED:${skill.name}] 或 [SKILL_FAILED:${skill.name}] <原因>`,
    "没有真的执行 skill 时，不要输出 [SKILL_USED]。",
    "从第二行开始输出最终回答正文，不要重复输出协议说明，也不要把这次请求改写成普通聊天。",
    "请始终使用中文回答，并避免编造页面中不存在的事实。",
  ]
    .filter(Boolean)
    .join("\n\n");
}
