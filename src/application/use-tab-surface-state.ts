import { useEffect, useMemo, useRef, useState } from "react";
import {
  getPendingNavigationTitle,
  normalizeBrowserInput,
  normalizeNewTabChatPrompt,
  resolveInternalSurfaceFromMenuCommand,
  shouldRouteNewTabInputToChat,
  type BrowserMenuCommand,
  type InternalSurface,
  type PendingNavigation,
  type SurfaceMode,
  type TabSurface,
} from "./browser-surface";
import {
  buildDisplayTabs,
  deriveSingleTabNewSurface,
  prunePendingNavigations,
  pruneTabSurfaceModes,
} from "./tab-surface-state-helpers";
import { getQaInitialSurface } from "../lib/qa-boot";
import type { SearchEngine } from "./use-ui-preferences";
import type { UiLocale } from "../../shared/localization.mjs";

export function useTabSurfaceState(params: {
  tabs: SabrinaDesktopTab[];
  activeTab: SabrinaDesktopTab | null;
  searchEngine: SearchEngine;
  uiLocale: UiLocale;
  createTab: (input?: string) => Promise<SabrinaDesktopTab | undefined>;
  navigateCurrentTab: (input: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  sendMessage: (overridePrompt?: string) => Promise<void>;
  sendNewTabChatMessage: (overridePrompt: string) => Promise<void>;
  subscribeBrowserMenuCommand: (
    listener: (command: BrowserMenuCommand) => void,
  ) => () => void;
}) {
  const {
    activeTab,
    clearHistory,
    createTab,
    navigateCurrentTab,
    searchEngine,
    uiLocale,
    sendMessage,
    sendNewTabChatMessage,
    subscribeBrowserMenuCommand,
    tabs,
  } = params;
  const [tabSurfaceModes, setTabSurfaceModes] = useState<Record<string, TabSurface>>({});
  const [inputUrl, setInputUrl] = useState("");
  const [newTabInput, setNewTabInput] = useState("");
  const [pendingNavigations, setPendingNavigations] = useState<
    Record<string, PendingNavigation>
  >({});
  const previousTabCountRef = useRef(0);
  const menuCommandHandlerRef = useRef<(command: BrowserMenuCommand) => void>(() => {});
  const qaSurfaceRef = useRef<InternalSurface | null>(getQaInitialSurface());
  const qaSurfaceOpenedRef = useRef(false);

  const activeTabSurface = activeTab ? tabSurfaceModes[activeTab.tabId] ?? null : null;
  const surfaceMode: SurfaceMode = activeTabSurface ?? "browser";

  const displayTabs = useMemo(
    () => buildDisplayTabs({ pendingNavigations, tabSurfaceModes, tabs, uiLocale }),
    [pendingNavigations, tabSurfaceModes, tabs, uiLocale],
  );

  const activeDisplayTab = useMemo(
    () =>
      displayTabs.find((tab) => tab.tabId === activeTab?.tabId) ??
      displayTabs[0] ??
      null,
    [activeTab?.tabId, displayTabs],
  );

  const addressDisplay =
    inputUrl !== ""
      ? inputUrl
      : surfaceMode === "newtab"
        ? ""
        : activeDisplayTab?.url ?? "";
  const isNewTabSurface = surfaceMode === "newtab";

  useEffect(() => {
    setTabSurfaceModes((current) => pruneTabSurfaceModes(current, tabs));
  }, [tabs]);

  useEffect(() => {
    setTabSurfaceModes((current) =>
      deriveSingleTabNewSurface({
        current,
        pendingNavigations,
        previousTabCount: previousTabCountRef.current,
        tabs,
      }),
    );

    previousTabCountRef.current = tabs.length;
  }, [pendingNavigations, tabs]);

  useEffect(() => {
    setPendingNavigations((current) => prunePendingNavigations(current, tabs));
  }, [tabs]);

  function clearTabSurface(tabId?: string | null) {
    if (!tabId) {
      return;
    }

    setTabSurfaceModes((current) => {
      if (!(tabId in current)) {
        return current;
      }

      const next = { ...current };
      delete next[tabId];
      return next;
    });
  }

  function clearPendingNavigation(tabId?: string | null) {
    if (!tabId) {
      return;
    }

    setPendingNavigations((current) => {
      if (!(tabId in current)) {
        return current;
      }

      const next = { ...current };
      delete next[tabId];
      return next;
    });
  }

  async function openBlankTab() {
    const nextTab = await createTab();
    const nextTabId = nextTab?.tabId;
    if (!nextTabId) {
      return;
    }

    setTabSurfaceModes((current) => ({
      ...current,
      [nextTabId]: "newtab",
    }));
    setInputUrl("");
    setNewTabInput("");
  }

  async function openInternalTab(surface: InternalSurface) {
    const nextTab = await createTab();
    const nextTabId = nextTab?.tabId;
    if (!nextTabId) {
      return;
    }

    setTabSurfaceModes((current) => ({
      ...current,
      [nextTabId]: surface,
    }));
    setInputUrl("");
  }

  async function openUrlInNewTab(url: string) {
    const nextUrl = url.trim();
    if (!nextUrl) {
      return;
    }

    const nextTab = await createTab(nextUrl);
    const nextTabId = nextTab?.tabId;
    if (!nextTabId) {
      return;
    }

    setPendingNavigations((current) => ({
      ...current,
      [nextTabId]: {
        title: getPendingNavigationTitle(uiLocale),
        url: normalizeBrowserInput(nextUrl, searchEngine),
      },
    }));
    setInputUrl("");
  }

  async function handleNavigate(url: string) {
    const next = url.trim();
    if (!next) {
      return;
    }

    const normalizedUrl = normalizeBrowserInput(next, searchEngine);
    const targetTabId = activeTab?.tabId;

    try {
      if (targetTabId) {
        setPendingNavigations((current) => ({
          ...current,
          [targetTabId]: {
            title: getPendingNavigationTitle(uiLocale),
            url: normalizedUrl,
          },
        }));
      }

      clearTabSurface(activeTab?.tabId);
      await navigateCurrentTab(next);
      setInputUrl("");
    } catch (error) {
      clearPendingNavigation(targetTabId);
      throw error;
    }
  }

  async function handleNewTabSubmit() {
    const value = newTabInput.trim();
    if (!value) {
      return;
    }

    if (shouldRouteNewTabInputToChat(value)) {
      await sendMessage(normalizeNewTabChatPrompt(value));
      setNewTabInput("");
      return;
    }

    await handleNavigate(value);
    setNewTabInput("");
  }

  async function handleNewTabChatSubmit() {
    const value = newTabInput.trim();
    if (!value) {
      return;
    }

    const prompt = normalizeNewTabChatPrompt(value);
    setNewTabInput("");
    await sendNewTabChatMessage(prompt);
  }

  async function handleMenuCommand(command: BrowserMenuCommand) {
    if (command === "clear-history") {
      await clearHistory();
      return;
    }

    if (command === "download-latest") {
      await openUrlInNewTab("https://sabrina.ai/download");
      return;
    }

    const surface = resolveInternalSurfaceFromMenuCommand(command);
    if (surface) {
      await openInternalTab(surface);
    }
  }

  menuCommandHandlerRef.current = (command) => {
    void handleMenuCommand(command);
  };

  useEffect(() => {
    const unsubscribe = subscribeBrowserMenuCommand((command) => {
      menuCommandHandlerRef.current(command);
    });

    return () => {
      unsubscribe();
    };
  }, [subscribeBrowserMenuCommand]);

  useEffect(() => {
    if (!qaSurfaceRef.current || qaSurfaceOpenedRef.current) {
      return;
    }

    qaSurfaceOpenedRef.current = true;
    void openInternalTab(qaSurfaceRef.current);
  }, [createTab, tabs.length]);

  return {
    inputUrl,
    setInputUrl,
    clearInputUrl: () => setInputUrl(""),
    newTabInput,
    setNewTabInput,
    displayTabs,
    surfaceMode,
    isNewTabSurface,
    addressDisplay,
    openBlankTab,
    openInternalTab,
    handleNavigate,
    handleNewTabSubmit,
    handleNewTabChatSubmit,
    handleMenuCommand,
  };
}
