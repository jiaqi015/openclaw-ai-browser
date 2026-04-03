/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useAppShellState } from "./application/use-app-shell-state";
import { useUiPreferences } from "./application/use-ui-preferences";
import { AppMainSurface } from "./components/app-main-surface";
import { AppSidebarPane } from "./components/app-sidebar-pane";
import { BrowserChrome } from "./components/browser-chrome";
import { NewTabSurface } from "./components/new-tab-surface";
import { cn } from "./lib/utils";
import { useAppController } from "./shell/useAppController";

export default function App() {
  const { preferences } = useUiPreferences();
  const controller = useAppController();
  const {
    browserChromeProps,
    newTabSurfaceProps,
    mainSurfaceProps,
    sidebarPaneProps,
    isDraggingState,
    isNewTabSurface,
    showBrowserFrame,
  } = useAppShellState({
    controller,
    preferences,
  });

  return (
    <div
      className={cn(
        "flex h-screen w-full bg-[#050505] text-white overflow-hidden",
        preferences.glassMode === "liquid" ? "liquid-shell" : "apple-gradient",
      )}
    >
      <div className="flex-1 flex flex-col overflow-hidden">
        <BrowserChrome {...browserChromeProps} />

        <div className="flex-1 relative bg-white overflow-hidden">
          {isNewTabSurface ? (
            <NewTabSurface {...newTabSurfaceProps} />
          ) : (
            <AppMainSurface {...mainSurfaceProps} />
          )}

          {showBrowserFrame && (
            <div
              className={cn(
                "absolute inset-0 pointer-events-none border-4",
                preferences.glassMode === "liquid" ? "border-white/6" : "border-white/8",
              )}
            />
          )}
          {isDraggingState && <div className="absolute inset-0 z-50 cursor-col-resize" />}
        </div>
      </div>

      <AppSidebarPane {...sidebarPaneProps} />
    </div>
  );
}
