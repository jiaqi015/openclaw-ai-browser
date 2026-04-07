import { useEffect, useMemo, useState } from "react";
import {
  getThreadSiteLabel,
  type SabrinaTabReferenceCandidate,
} from "../application/sabrina-openclaw";

export type SabrinaComposerSkill = {
  name: string;
  label: string;
};

function ensureReferenceList(selectedIds: string[], activeTabId: string | null) {
  return selectedIds.filter((tabId) => tabId && tabId !== activeTabId);
}

function filterSelectableReferences(
  current: Record<string, string[]>,
  tabs: SabrinaDesktopTab[],
  activeTabId: string | null,
) {
  const validTabIds = new Set(tabs.map((tab) => tab.tabId));
  return Object.fromEntries(
    Object.entries(current).map(([threadId, selectedIds]) => [
      threadId,
      ensureReferenceList(selectedIds ?? [], activeTabId).filter((tabId) => validTabIds.has(tabId)),
    ]),
  );
}

export function useThreadComposerState(params: {
  tabs: SabrinaDesktopTab[];
  activeTab: SabrinaDesktopTab | null;
  activeThreadId: string | null;
}) {
  const { activeTab, activeThreadId, tabs } = params;
  const [composerText, setComposerText] = useState("");
  const [referenceQuery, setReferenceQuery] = useState("");
  const [pendingByThreadId, setPendingByThreadId] = useState<Record<string, boolean>>({});
  const [selectedReferenceIdsByThreadId, setSelectedReferenceIdsByThreadId] = useState<
    Record<string, string[]>
  >({});
  const [selectedSkillByThreadId, setSelectedSkillByThreadId] = useState<
    Record<string, SabrinaComposerSkill | null>
  >({});

  useEffect(() => {
    setSelectedReferenceIdsByThreadId((current) =>
      filterSelectableReferences(current, tabs, activeTab?.tabId ?? null),
    );
  }, [activeTab?.tabId, tabs]);

  const referenceCandidates = useMemo<SabrinaTabReferenceCandidate[]>(
    () =>
      tabs
        .filter((tab) => tab.tabId !== activeTab?.tabId)
        .map((tab) => ({
          id: tab.tabId,
          title: tab.title || "当前页面",
          host: getThreadSiteLabel(tab.url),
          url: tab.url,
          favicon: tab.favicon,
          active: tab.tabId === activeTab?.tabId,
          sourceAvailability: tab.sourceAvailability,
        })),
    [activeTab?.tabId, tabs],
  );

  const isThinking = activeThreadId ? Boolean(pendingByThreadId[activeThreadId]) : false;
  const selectedReferenceIds = activeThreadId
    ? ensureReferenceList(
        selectedReferenceIdsByThreadId[activeThreadId] ?? [],
        activeTab?.tabId ?? null,
      )
    : [];
  const selectedComposerSkill = activeThreadId
    ? selectedSkillByThreadId[activeThreadId] ?? null
    : null;

  function setPending(threadId: string, pending: boolean) {
    if (!threadId) {
      return;
    }

    setPendingByThreadId((current) => ({
      ...current,
      [threadId]: pending,
    }));
  }

  function toggleReference(tabId: string) {
    if (!activeThreadId) {
      return;
    }

    setSelectedReferenceIdsByThreadId((current) => {
      const existing = current[activeThreadId] ?? [];
      const nextSelected = existing.includes(tabId)
        ? existing.filter((entry) => entry !== tabId)
        : [...existing, tabId];

      return {
        ...current,
        [activeThreadId]: ensureReferenceList(nextSelected, activeTab?.tabId ?? null),
      };
    });
  }

  function clearSelectedReferences(threadId = activeThreadId) {
    const resolvedThreadId = typeof threadId === "string" ? threadId : activeThreadId;
    if (!resolvedThreadId) {
      return;
    }

    setSelectedReferenceIdsByThreadId((current) => ({
      ...current,
      [resolvedThreadId]: [],
    }));
    setReferenceQuery("");
  }

  function setSelectedComposerSkill(skill: SabrinaComposerSkill | null, threadId = activeThreadId) {
    const resolvedThreadId = typeof threadId === "string" ? threadId : activeThreadId;
    if (!resolvedThreadId) {
      return;
    }

    setSelectedSkillByThreadId((current) => ({
      ...current,
      [resolvedThreadId]: skill,
    }));
  }

  function clearSelectedComposerSkill(threadId = activeThreadId) {
    setSelectedComposerSkill(null, threadId);
  }

  return {
    composerText,
    referenceQuery,
    referenceCandidates,
    selectedReferenceIds,
    selectedComposerSkill,
    isThinking,
    clearSelectedReferences,
    clearSelectedComposerSkill,
    setComposerText,
    setPending,
    setReferenceQuery,
    setSelectedComposerSkill,
    toggleReference,
  };
}
