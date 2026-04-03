import { useEffect, useMemo, useState } from "react";
import {
  formatThreadTimestampLabel,
  type SabrinaThreadSummary,
} from "../application/sabrina-openclaw";
import { type SabrinaChatMessage } from "../application/sabrina-chat";

type SabrinaDesktop = NonNullable<Window["sabrinaDesktop"]>;

function createEmptyState(): SabrinaThreadRuntimeResolution {
  return {
    state: {
      threadsById: {},
      threadOrder: [],
      messagesByThreadId: {},
      pageThreadIds: {},
    },
    tabThreads: {},
  };
}

function getThreadPreview(messages: SabrinaChatMessage[]) {
  const previewMessage = [...messages]
    .reverse()
    .find((message) => message.role !== "system");

  return previewMessage?.text?.trim() || "关于这个页面的历史对话会显示在这里。";
}

function getRuntimeSignature(runtimeState: SabrinaThreadRuntimeResolution) {
  return JSON.stringify(runtimeState);
}

export function useThreadState(params: {
  desktop?: SabrinaDesktop;
  tabs: SabrinaDesktopTab[];
  activeTab: SabrinaDesktopTab | null;
}) {
  const { activeTab, desktop } = params;
  const [runtimeState, setRuntimeState] = useState<SabrinaThreadRuntimeResolution>(
    createEmptyState,
  );

  useEffect(() => {
    if (!desktop?.threads?.getRuntimeState) {
      setRuntimeState(createEmptyState());
      return;
    }

    let mounted = true;

    void desktop.threads
      .getRuntimeState()
      .then((nextRuntimeState) => {
        if (!mounted) {
          return;
        }

        setRuntimeState((current) =>
          getRuntimeSignature(current) === getRuntimeSignature(nextRuntimeState)
            ? current
            : nextRuntimeState,
        );
      })
      .catch(() => {});

    const unsubscribe = desktop.threads.onRuntimeState?.((nextRuntimeState) => {
      if (!mounted) {
        return;
      }

      setRuntimeState((current) =>
        getRuntimeSignature(current) === getRuntimeSignature(nextRuntimeState)
          ? current
          : nextRuntimeState,
      );
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [desktop]);

  const activeThreadId = activeTab
    ? runtimeState.tabThreads[activeTab.tabId]?.threadId ?? null
    : null;
  const activeMessages = activeThreadId
    ? runtimeState.state.messagesByThreadId[activeThreadId] ?? []
    : [];

  const threadSummaries = useMemo<SabrinaThreadSummary[]>(
    () =>
      runtimeState.state.threadOrder
        .map((threadId) => {
          const thread = runtimeState.state.threadsById[threadId];
          if (!thread) {
            return null;
          }

          const messages = runtimeState.state.messagesByThreadId[threadId] ?? [];
          const lastMessage = [...messages]
            .reverse()
            .find((message) => message.role !== "system");
          return {
            threadId,
            title: thread.title,
            siteLabel: thread.siteLabel,
            siteHost: thread.siteHost,
            preview: getThreadPreview(messages),
            updatedAt: thread.updatedAt,
            updatedAtLabel: formatThreadTimestampLabel(thread.updatedAt),
            active: activeThreadId === threadId,
            status: (lastMessage?.role === "error" ? "error" : "active") as
              | "active"
              | "error",
          };
        })
        .filter(Boolean) as SabrinaThreadSummary[],
    [activeThreadId, runtimeState],
  );

  async function appendMessage(threadId: string, message: SabrinaChatMessage) {
    if (!desktop?.threads?.appendMessage) {
      return;
    }

    const nextRuntimeState = await desktop.threads.appendMessage({
      threadId,
      message,
    });
    setRuntimeState((current) =>
      getRuntimeSignature(current) === getRuntimeSignature(nextRuntimeState)
        ? current
        : nextRuntimeState,
    );
  }

  function selectThread(threadId: string) {
    if (!activeTab || !runtimeState.state.threadsById[threadId] || !desktop?.threads?.selectThread) {
      return;
    }

    void desktop.threads
      .selectThread({
        tabId: activeTab.tabId,
        threadId,
        url: activeTab.url,
      })
      .then((nextRuntimeState) => {
        setRuntimeState((current) =>
          getRuntimeSignature(current) === getRuntimeSignature(nextRuntimeState)
            ? current
            : nextRuntimeState,
        );
      })
      .catch(() => {});
  }

  return {
    activeThreadId,
    activeMessages,
    threadSummaries,
    appendMessage,
    selectThread,
  };
}
