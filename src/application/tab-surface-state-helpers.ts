import {
  getTabSurfaceMeta,
  type PendingNavigation,
  type TabSurface,
} from "./browser-surface";
import type { UiLocale } from "../../shared/localization.mjs";

export function buildDisplayTabs(params: {
  pendingNavigations: Record<string, PendingNavigation>;
  tabSurfaceModes: Record<string, TabSurface>;
  tabs: SabrinaDesktopTab[];
  uiLocale: UiLocale;
}) {
  const { pendingNavigations, tabSurfaceModes, tabs, uiLocale } = params;
  const tabSurfaceMeta = getTabSurfaceMeta(uiLocale);

  return tabs.map((tab) => {
    const pendingNavigation = pendingNavigations[tab.tabId];
    const tabSurface = tabSurfaceModes[tab.tabId];
    if (tabSurface) {
      return {
        ...tab,
        title: tabSurfaceMeta[tabSurface].title,
        url: tabSurfaceMeta[tabSurface].url,
        favicon: null,
        systemIcon: tabSurfaceMeta[tabSurface].icon,
        loading: false,
      };
    }

    if (pendingNavigation) {
      return {
        ...tab,
        title: pendingNavigation.title,
        url: pendingNavigation.url,
        systemIcon: null,
      };
    }

    return {
      ...tab,
      systemIcon: null,
    };
  });
}

export function pruneTabSurfaceModes(
  current: Record<string, TabSurface>,
  tabs: SabrinaDesktopTab[],
) {
  const nextEntries = Object.entries(current).filter(([tabId]) =>
    tabs.some((tab) => tab.tabId === tabId),
  );

  if (nextEntries.length === Object.keys(current).length) {
    return current;
  }

  return Object.fromEntries(nextEntries) as Record<string, TabSurface>;
}

export function deriveSingleTabNewSurface(params: {
  current: Record<string, TabSurface>;
  pendingNavigations: Record<string, PendingNavigation>;
  previousTabCount: number;
  tabs: SabrinaDesktopTab[];
}): Record<string, TabSurface> {
  const { current, pendingNavigations, previousTabCount, tabs } = params;
  if (tabs.length !== 1 || previousTabCount <= 1) {
    return current;
  }

  const fallbackTab = tabs[0];
  if (!fallbackTab) {
    return current;
  }

  if (
    fallbackTab.url !== "about:blank" ||
    fallbackTab.loading ||
    Boolean(fallbackTab.lastError) ||
    fallbackTab.tabId in current ||
    fallbackTab.tabId in pendingNavigations
  ) {
    return current;
  }

  return {
    ...current,
    [fallbackTab.tabId]: "newtab",
  };
}

export function prunePendingNavigations(
  current: Record<string, PendingNavigation>,
  tabs: SabrinaDesktopTab[],
) {
  const nextEntries = Object.entries(current).filter(([tabId, pending]) => {
    const tab = tabs.find((item) => item.tabId === tabId);
    if (!tab) {
      return false;
    }

    if (tab.lastError) {
      return false;
    }

    if (tab.url !== "about:blank" && tab.url !== pending.url) {
      return false;
    }

    if (!tab.loading) {
      return false;
    }

    return true;
  });

  if (nextEntries.length === Object.keys(current).length) {
    return current;
  }

  return Object.fromEntries(nextEntries) as Record<string, PendingNavigation>;
}
