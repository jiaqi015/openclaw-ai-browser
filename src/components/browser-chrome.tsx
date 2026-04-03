import { type MouseEvent as ReactMouseEvent, type RefObject } from "react";
import { motion } from "motion/react";
import {
  ChevronLeft,
  ChevronRight,
  Globe,
  Loader2,
  MoreHorizontal,
  Plus,
  RotateCw,
  Search,
  Star,
  X,
} from "lucide-react";
import type { BrowserMenuCommand, SystemEntryIconName } from "../application/browser-surface";
import { BrowserMenuDropdown } from "./browser-menu-dropdown";
import { ChatTextIcon } from "./custom-ai-icon";
import { SystemEntryIcon } from "./system-entry-icon";
import { cn } from "../lib/utils";

export function BrowserChrome(props: {
  displayTabs: Array<{
    tabId: string;
    title: string;
    favicon: string | null;
    loading: boolean;
    systemIcon?: SystemEntryIconName | null;
  }>;
  activeTabId: string | null | undefined;
  activeTabCanGoBack: boolean;
  activeTabCanGoForward: boolean;
  addressDisplay: string;
  isBookmarked: boolean;
  isBrowserMenuOpen: boolean;
  isMacDesktop: boolean;
  isMacWindowExpanded: boolean;
  sidebarOpen: boolean;
  supportsNativeBrowserMenu: boolean;
  browserMenuRef: RefObject<HTMLDivElement | null>;
  onActivateTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onCreateTab: () => void;
  onAddressChange: (value: string) => void;
  onAddressBlur: () => void;
  onNavigate: () => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onReload: () => void;
  onToggleBookmark: () => void;
  onBrowserMenuTrigger: (event: ReactMouseEvent<HTMLButtonElement>) => void | Promise<void>;
  onCloseMenu: () => void;
  onSelectMenu: (command: BrowserMenuCommand) => void;
  onToggleSidebar: () => void;
}) {
  const {
    displayTabs,
    activeTabId,
    activeTabCanGoBack,
    activeTabCanGoForward,
    addressDisplay,
    isBookmarked,
    isBrowserMenuOpen,
    isMacDesktop,
    isMacWindowExpanded,
    sidebarOpen,
    supportsNativeBrowserMenu,
    browserMenuRef,
    onActivateTab,
    onCloseTab,
    onCreateTab,
    onAddressChange,
    onAddressBlur,
    onNavigate,
    onGoBack,
    onGoForward,
    onReload,
    onToggleBookmark,
    onBrowserMenuTrigger,
    onCloseMenu,
    onSelectMenu,
    onToggleSidebar,
  } = props;

  return (
    <>
      <div
        className={cn(
          "drag-region surface-toolbar-strong surface-window-bar h-12 flex items-center gap-2 border-b no-scrollbar overflow-x-auto",
          isMacDesktop && !isMacWindowExpanded ? "pl-[92px] pr-4" : "px-4",
        )}
      >
        {displayTabs.map((tab) => (
          <motion.div
            key={tab.tabId}
            layoutId={tab.tabId}
            onClick={() => onActivateTab(tab.tabId)}
            className={cn(
              "no-drag surface-tab flex items-center gap-2 px-4 py-1.5 rounded-lg cursor-pointer transition-all min-w-[140px] max-w-[200px] group relative",
              activeTabId === tab.tabId && "surface-tab-active",
            )}
          >
            {tab.systemIcon ? (
              <SystemEntryIcon name={tab.systemIcon} variant="tab" className="h-5 w-5" />
            ) : tab.favicon ? (
              <img src={tab.favicon} className="w-4 h-4 rounded-sm object-cover" alt="" />
            ) : (
              <Globe className="w-4 h-4" />
            )}
            <span className="text-xs font-medium truncate flex-1">{tab.title}</span>
            {tab.loading && <Loader2 className="w-3 h-3 animate-spin text-white/35" />}
            {displayTabs.length > 1 && (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onCloseTab(tab.tabId);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/10 rounded-full transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            {activeTabId === tab.tabId && (
              <motion.div
                layoutId="active-pill"
                className="absolute bottom-0 left-2 right-2 h-0.5 bg-apple-pink rounded-full"
              />
            )}
          </motion.div>
        ))}
        <button
          onClick={onCreateTab}
          className="no-drag surface-icon-button p-2 rounded-lg transition-all"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="drag-region surface-toolbar surface-window-bar h-14 flex items-center px-6 gap-4 border-b relative z-20">
        <div className="no-drag flex items-center gap-1">
          <button
            onClick={onGoBack}
            className="surface-icon-button p-2 rounded-full disabled:opacity-20 transition-colors"
            disabled={!activeTabCanGoBack}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={onGoForward}
            className="surface-icon-button p-2 rounded-full disabled:opacity-20 transition-colors"
            disabled={!activeTabCanGoForward}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={onReload}
            className="surface-icon-button p-2 rounded-full transition-colors"
            disabled={!activeTabId}
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        <div className="no-drag flex-1 max-w-5xl mx-auto relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-white/40 group-focus-within:text-white/72 transition-colors" />
          </div>
          <input
            type="text"
            placeholder="搜索或输入网站名称"
            value={addressDisplay}
            onChange={(event) => onAddressChange(event.target.value)}
            onFocus={(event) => event.target.select()}
            onBlur={onAddressBlur}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onNavigate();
              }
            }}
            className="surface-input w-full h-9 rounded-xl pl-12 pr-10 text-sm focus:outline-none transition-all border"
          />
          <div className="absolute inset-y-0 right-2 flex items-center">
            <button
              onClick={onToggleBookmark}
              className="surface-icon-button p-1.5 rounded-md transition-colors"
              title={isBookmarked ? "取消书签" : "添加书签"}
            >
              <Star
                className={cn("w-4 h-4", isBookmarked && "fill-yellow-400 text-yellow-400")}
              />
            </button>
          </div>
        </div>

        <div className="no-drag flex items-center gap-2">
          <div className="relative no-drag" ref={browserMenuRef}>
            <button
              onClick={onBrowserMenuTrigger}
              className={cn(
                "surface-icon-button p-2 rounded-full transition-all",
                isBrowserMenuOpen && "surface-icon-button-active",
              )}
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            {!supportsNativeBrowserMenu && (
              <BrowserMenuDropdown
                open={isBrowserMenuOpen}
                onClose={onCloseMenu}
                onSelect={onSelectMenu}
              />
            )}
          </div>
          <button
            onClick={onToggleSidebar}
            className={cn(
              "surface-icon-button p-2 rounded-full transition-all",
              sidebarOpen && "surface-icon-button-active",
            )}
          >
            <ChatTextIcon className="w-10 h-5" />
          </button>
        </div>
      </div>
    </>
  );
}
