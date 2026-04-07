import { useMemo } from "react";
import {
  getThreadSiteLabel,
  type SabrinaTabReferenceCandidate,
} from "../application/sabrina-openclaw";

function toReferenceCandidate(
  tab: SabrinaDesktopTab,
  options: { implicitPrimary?: boolean } = {},
): SabrinaTabReferenceCandidate {
  return {
    id: tab.tabId,
    title: tab.title || "当前页面",
    host: getThreadSiteLabel(tab.url),
    url: tab.url,
    favicon: tab.favicon,
    active: false,
    implicitPrimary: Boolean(options.implicitPrimary),
    sourceAvailability: tab.sourceAvailability,
  };
}

export function useGenTabSourceState(params: {
  tabs: SabrinaDesktopTab[];
  activeTab: SabrinaDesktopTab | null;
  selectedReferenceIds: string[];
}) {
  const { activeTab, selectedReferenceIds, tabs } = params;

  return useMemo(() => {
    const primarySourceTab = activeTab
      ? toReferenceCandidate(activeTab, { implicitPrimary: true })
      : null;
    const referenceCandidates = tabs
      .filter((tab) => tab.tabId !== activeTab?.tabId)
      .map((tab) => toReferenceCandidate(tab));
    const selectedReferenceTabs = referenceCandidates.filter((tab) =>
      selectedReferenceIds.includes(tab.id),
    );
    const readyReferenceTabs = selectedReferenceTabs.filter(
      (tab) => tab.sourceAvailability?.canReference,
    );

    const canUseCurrentPage = Boolean(primarySourceTab?.sourceAvailability?.canUseAsPrimary);
    const totalSourcePageCount = (canUseCurrentPage ? 1 : 0) + readyReferenceTabs.length;

    let blockedReason = "";
    if (!primarySourceTab) {
      blockedReason = "当前没有可用页面，暂时无法生成 GenTab。";
    } else if (!canUseCurrentPage) {
      blockedReason = primarySourceTab.sourceAvailability?.label || "当前页面暂不可作为来源。";
    } else if (readyReferenceTabs.length < 1) {
      blockedReason = "至少再引用 1 个可用页面，和当前页一起生成 GenTab。";
    }

    return {
      primarySourceTab,
      referenceCandidates,
      selectedReferenceTabs,
      readyReferenceTabs,
      totalSourcePageCount,
      canGenerate: blockedReason.length === 0,
      blockedReason,
    };
  }, [activeTab, selectedReferenceIds, tabs]);
}
