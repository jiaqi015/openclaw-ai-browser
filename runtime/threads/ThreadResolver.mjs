import {
  getThreadSiteLabel,
  getUrlHostLabel,
  normalizePageKey,
  shouldReuseThreadOnNavigation,
} from "./ThreadMetadata.mjs";

export { normalizePageKey } from "./ThreadMetadata.mjs";

function createThreadId() {
  return `thread-${Math.random().toString(36).slice(2, 10)}`;
}

function createMessageId() {
  return `msg-${Math.random().toString(36).slice(2, 10)}`;
}

function createWelcomeMessage(tab) {
  return {
    messageId: createMessageId(),
    role: "system",
    text: [
      "### Sabrina 已接入真实网页",
      `- 当前标签页：**${tab?.title || "新标签页"}**`,
      "- 右侧可以直接总结网页、提取要点，或者基于当前页面继续追问。",
      "- 如果你先在网页里划词，AI 会优先使用选中的文本作为上下文。",
    ].join("\n"),
  };
}

function createIsoTimestamp(input = Date.now()) {
  return new Date(input).toISOString();
}

function getFallbackThreadTitle(tab) {
  return tab?.title || getThreadSiteLabel(tab?.url) || "当前页面";
}

function touchThreadOrder(order, threadId) {
  return [threadId, ...order.filter((entry) => entry !== threadId)];
}

function createThreadRecord(tab, pageKey) {
  const now = createIsoTimestamp();
  return {
    threadId: createThreadId(),
    title: getFallbackThreadTitle(tab),
    originUrl: tab.url,
    pageKey,
    siteHost: getUrlHostLabel(tab.url),
    siteLabel: getThreadSiteLabel(tab.url),
    updatedAt: now,
  };
}

export function resolveThreadRuntime(payload = {}) {
  const persistedState = payload?.state ?? payload?.persistedState ?? {};
  const tabThreads = payload?.tabThreads ?? {};
  const tabs = Array.isArray(payload?.tabs) ? payload.tabs : [];

  const nextPersistedState = {
    threadsById: { ...(persistedState?.threadsById ?? {}) },
    messagesByThreadId: { ...(persistedState?.messagesByThreadId ?? {}) },
    pageThreadIds: { ...(persistedState?.pageThreadIds ?? {}) },
    threadOrder: Array.isArray(persistedState?.threadOrder) ? [...persistedState.threadOrder] : [],
  };
  const nextTabThreads = {};

  for (const tab of tabs) {
    const pageKey = normalizePageKey(tab.url);
    const runtime = tabThreads?.[tab.tabId];
    let threadId = runtime?.threadId ?? "";

    if (runtime && runtime.url === tab.url) {
      threadId = runtime.threadId;
    } else if (runtime && shouldReuseThreadOnNavigation(runtime.url, tab.url)) {
      threadId = runtime.threadId;
    } else if (pageKey && nextPersistedState.pageThreadIds[pageKey]) {
      threadId = nextPersistedState.pageThreadIds[pageKey];
    }

    if (!threadId || !nextPersistedState.threadsById[threadId]) {
      const thread = createThreadRecord(tab, pageKey);
      threadId = thread.threadId;
      nextPersistedState.threadsById[threadId] = thread;
      nextPersistedState.messagesByThreadId[threadId] = [createWelcomeMessage(tab)];
      nextPersistedState.threadOrder = touchThreadOrder(nextPersistedState.threadOrder, threadId);
    }

    const previousThread = nextPersistedState.threadsById[threadId];
    if (
      previousThread.title !== getFallbackThreadTitle(tab) ||
      previousThread.originUrl !== tab.url ||
      previousThread.pageKey !== pageKey ||
      previousThread.siteHost !== getUrlHostLabel(tab.url) ||
      previousThread.siteLabel !== getThreadSiteLabel(tab.url)
    ) {
      nextPersistedState.threadsById[threadId] = {
        ...previousThread,
        title: getFallbackThreadTitle(tab),
        originUrl: tab.url,
        pageKey,
        siteHost: getUrlHostLabel(tab.url),
        siteLabel: getThreadSiteLabel(tab.url),
      };
    }

    if (pageKey) {
      nextPersistedState.pageThreadIds[pageKey] = threadId;
    }

    nextTabThreads[tab.tabId] = {
      threadId,
      url: tab.url,
      pageKey,
    };
  }

  return {
    state: nextPersistedState,
    tabThreads: nextTabThreads,
  };
}
