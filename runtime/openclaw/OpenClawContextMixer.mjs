import { serializeThreadStoreState } from "../threads/ThreadStore.mjs";
import { getTabWebContentsById } from "../browser/TabManager.mjs";

/**
 * OpenClaw 上下文混合器 (V9: Balanced Context)
 * 负责勾兑来自 Chat, Tab 和 Agent 的碎片化信息
 */
export async function mixOpenClawContext(params) {
  const { threadId, currentTabId, task, journal = [] } = params;

  // 1. 获取对话历史 (Chat Context)
  const threadState = serializeThreadStoreState();
  const rawMessages = threadState.messagesByThreadId[threadId] || [];
  
  // 仅保留最近 10 条消息以节省 Token
  const history = rawMessages.slice(-10).map(msg => ({
    role: msg.role,
    content: msg.text
  }));

  // 2. 获取当前标签页上下文 (Tab Context)
  const webContents = getTabWebContentsById(currentTabId);
  const tabContext = webContents ? {
    title: webContents.getTitle(),
    url: webContents.getURL(),
    isDestroyed: webContents.isDestroyed()
  } : null;

  // 3. 获取 Agent 动作摘要 (Action Context)
  const actionHistory = journal.map(entry => ({
    step: entry.step,
    action: entry.action?.action,
    reason: entry.action?.reason,
    result: entry.result?.ok ? "success" : `failed: ${entry.result?.error}`
  }));

  // 4. 合并上下文
  return {
    globalGoal: task,
    history,
    tabContext,
    actionHistory,
    timestamp: new Date().toISOString()
  };
}

/**
 * 提取核心意图 (Intent Extraction)
 * 从混合上下文中提炼出当前最紧迫的约束
 */
export function extractIntentConstraints(mixedContext) {
  const constraints = [];
  
  // 从历史对话中寻找明确的偏好 (如 "我喜欢...", "不要...")
  const lastUserMessages = mixedContext.history.filter(m => m.role === 'user').slice(-3);
  lastUserMessages.forEach(msg => {
    // 简单的关键词提取逻辑（实际应用中可能需要 LLM 先行提炼）
    if (/喜欢|想要|优先|不要|过滤|排除/.test(msg.content)) {
      constraints.push(msg.content);
    }
  });

  return constraints;
}
