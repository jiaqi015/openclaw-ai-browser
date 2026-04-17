/**
 * BrowserAgentPromptService.mjs
 * Agent 提示词构建服务。
 */

import { formatNarration } from "./PageNarratorService.mjs";

export function buildAgentPrompt(task, snapshot, journal = [], userData = null, narration = null) {
  const { history = [], constraints = [], taskTree = [], experiences = null } = userData || {};

  const recentJournal = journal.slice(-5).map(entry => {
    const actionDesc = formatAction(entry.action);
    const resultDesc = entry.result?.ok ? "成功" : `失败: ${entry.result?.error || "未知错误"}`;
    return `- 步骤 ${entry.step}: ${actionDesc} -> ${resultDesc}`;
  }).join("\n");

  const blockedZones = (snapshot.interactiveElements || [])
    .filter(e => e.failureCount >= 2)
    .map(e => `- [${e.index}] "${e.text}" (此路径已多次尝试失败，禁止再次点击，请尝试其他策略)`)
    .join("\n");

  const experiencesDesc = experiences
    ? Object.entries(experiences).map(([type, exp]) => `- [已有经验] 在此网站进行 "${type}" 时，历史成功技巧：${exp.tip}`).join("\n")
    : "（此门户网站尚无历史成功经验，请你自行探索最稳健的路径）";

  const userDataDesc = userData && typeof userData === 'object' && !Array.isArray(userData)
    ? Object.entries(userData)
        .filter(([k]) => !['history', 'constraints', 'taskTree', 'experiences'].includes(k))
        .map(([k, v]) => `- ${k}: ${v}`).join("\n")
    : "（用户未提供额外数据）";

  const historyDesc = history.length > 0
    ? history.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join("\n")
    : "（无对话历史）";

  const constraintsDesc = constraints.length > 0
    ? constraints.map(c => `- ${c}`).join("\n")
    : "（无特殊意图约束）";

  const planDesc = taskTree.length > 0
    ? taskTree.map(p => `- [${p.status === 'done' ? 'x' : ' '}] ${p.title} (${p.status})`).join("\n")
    : "（尚未制定详细计划）";

  // 页面状态：优先用 Narrator 格式化（场景分类 + 关键元素评分 + diff），降级用原始转储
  const pageStateDesc = narration
    ? formatNarration(narration, snapshot.interactiveElements || [])
    : buildRawPageDesc(snapshot);

  return `你是 Sabrina 浏览器的操作助手。用户给了你一个任务，你在操作一个真实的网页来完成它。

${blockedZones ? `\n## 禁区警告 (CRITICAL)\n警告：以下元素由于多次操作未生效已被列为禁止区域。请不要再次尝试点击它们，你应该尝试寻找替代方案（如：搜索、刷新、点击同级元素或回退）。\n${blockedZones}\n` : ""}

## 任务
${task}

## [重要] 核心准则：行动导向 (Action-Oriented)
1. **不要过度询问**：如果任务包含明确的动词（如"搜索"、"点击"、"填写"），请直接执行最符合语义的操作。
2. **利用经验**：参考下方的 [历史成功经验]，它们能帮你避开常见的反爬或 UI 陷阱。
3. **自信决策**：你的目标是"达成结果"，而不是"保持对话"。

## 历史成功经验 (Experience)
${experiencesDesc}

## 用户提供的数据
${userDataDesc}

${pageStateDesc}

## 对话历史与意图约束 (Context)
此处的上下文来自你之前的 Chat 对话，请务必遵守用户在对话中提到的偏好：
${constraintsDesc}

### 最近对话记录
${historyDesc}

## 当前执行计划 (Task Tree)
你可以根据当前页面状态动态调整计划。
${planDesc}

## 操作历史 (最近 5 步)
${recentJournal || "（无历史记录）"}

## 你的输出方式 (Self-Correction Loop)
1. **分析现状**：查看页面 diff（见"上一步变化"），判断上一个动作是否生效。
2. **校验结果**：你上一步的 'expectations' 达到了吗？
3. **决定下一步**：执行动作或调整计划。

每次只输出一个 JSON 动作，**并描述该动作执行后的预期变化**。不要包含任何解释或 Markdown 代码块。

点击元素：    {"action": "click", "index": 3, "reason": "点击提交按钮", "expectations": {"urlChanged": true}}
填写字段：    {"action": "fill", "index": 5, "text": "张三", "reason": "填写姓名", "expectations": {"domChanged": true}}
填写并提交：  {"action": "fill", "index": 5, "text": "贝壳新闻", "submit": true, "reason": "搜索关键词并提交", "expectations": {"urlChanged": true}}
选择下拉：    {"action": "select", "index": 7, "value": "北京", "reason": "选择城市", "expectations": {"domChanged": true}}
滚动页面：    {"action": "scroll", "direction": "down", "reason": "查看更多内容（懒加载）", "expectations": {"domChanged": true}}
跳转页面：    {"action": "navigate", "url": "https://...", "reason": "进入注册页", "expectations": {"urlChanged": true}}
任务完成：    {"action": "done", "summary": "已填写完所有字段，等待用户确认提交"}
无法继续：    {"action": "error", "message": "页面要求验证码，需要用户手动完成（已尝试滚动和等待）"}

## 规则

1. 每次只输出一个动作，不要规划多步。
2. 每个操作（除了 done/error）必须包含 expectations 对象，说明预期的变化（urlChanged 或 domChanged 或 elementAppeared: "选择器"）。
3. 密码字段用 {"action": "fill", "index": N, "text": "__PASSWORD__"}，系统会提示用户自行输入。
4. 如果页面有验证码 (CAPTCHA)，输出 error 让用户处理。
5. 如果连续两步操作了同一个元素但页面没变化，换一种方式（滚动/刷新/等待后重试）。
6. 填写数据优先用"用户提供的数据"，没有提供的字段跳过或用 error 告知。
7. 任务完成后，输出 done 并描述做了什么。
8. **动态规划**：如果你认为当前计划需要调整（新增子任务、改变顺序或移除），你可以在 JSON 中包含一个可选字段 "new_plan": [{"id": 1, "title": "任务描述", "status": "pending"}, ...]。
9. **填写表单字段后不要自动提交**：fill 动作只填写内容，若需要提交请加 "submit": true（仅搜索框等场景）。

## ⚠️ 关键：绝不在第一次观察时放弃

- 如果可交互元素列表较少或有空文本，**优先尝试 scroll down 一次**，等待懒加载后再重新规划。
- 如果页面看起来是空的，先 scroll 再 wait，不要直接 error。
- **error 是最后手段**：只有在确认：①已滚动整个页面 ②已等待3秒以上 ③确实无法绕过（如强制验证码） 才能输出 error。
- 页面"元素少"不等于"无法操作"——先探索，后放弃。

只输出 JSON，不要解释。`;
}

/**
 * 降级：当 narration 不可用时，直接转储快照中的元素
 */
function buildRawPageDesc(snapshot) {
  const els = (snapshot.interactiveElements || []).map(el => {
    const typeStr = el.type ? ` type="${el.type}"` : "";
    const valueStr = el.value ? ` 值="${el.value}"` : "";
    const disabledStr = el.disabled ? " [禁用]" : "";
    const failureStr = el.failureCount > 0 ? ` [已失败 ${el.failureCount} 次]` : "";
    return `[${el.index}] <${el.tag}${typeStr}> "${el.text}"${valueStr}${disabledStr}${failureStr}`;
  }).join("\n");

  return `## 当前页面状态
URL: ${snapshot.url}
标题: ${snapshot.title}
滚动位置: ${snapshot.scrollPosition?.y ?? 0}/${snapshot.scrollPosition?.scrollHeight ?? 0}${snapshot.hasMoreContent ? " ⬇️ 页面下方还有更多内容，可以 scroll down" : " (已到底部或内容已全部可见)"}
可交互元素总数: ${snapshot.interactiveElements?.length ?? 0}

### 可交互元素
${els}

### 页面文本 (摘要)
${(snapshot.pageText || "").slice(0, 2000)}`;
}

function formatAction(action) {
  switch (action.action) {
    case "click": return `点击元素 [${action.index}]`;
    case "fill": return `填写元素 [${action.index}] 为 "${action.text}"`;
    case "select": return `选择元素 [${action.index}] 的值为 "${action.value}"`;
    case "scroll": return `向${action.direction === "down" ? "下" : "上"}滚动页面`;
    case "navigate": return `跳转到 ${action.url}`;
    case "done": return "任务完成";
    case "error": return `错误: ${action.message}`;
    default: return "未知操作";
  }
}

export function parseAgentAction(llmResponse) {
  try {
    let responseText = "";
    if (typeof llmResponse === 'string') {
      responseText = llmResponse;
    } else if (typeof llmResponse === 'object' && llmResponse !== null) {
      responseText = llmResponse.content || llmResponse.text || llmResponse.message || JSON.stringify(llmResponse);
    }

    // 如果已经是对象且包含 action，直接返回
    if (typeof llmResponse === 'object' && llmResponse !== null && llmResponse.action) {
      return llmResponse;
    }

    // 尝试从字符串中提取 JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : responseText;
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("[Parser] LLM Response parsing failed:", error, llmResponse);
    return { action: "error", message: `无法解析 LLM 响应: ${typeof llmResponse === 'object' ? '[Object]' : llmResponse}` };
  }
}
