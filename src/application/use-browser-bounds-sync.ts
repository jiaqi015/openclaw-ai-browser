import { useEffect } from "react";

export function useBrowserBoundsSync(params: {
  browserSurfaceRef: React.RefObject<HTMLDivElement | null>;
  surfaceMode: string;
  activeTabId: string | undefined;
  sidebarOpen: boolean;
  sidebarWidth: number;
  setBrowserBounds: (bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => Promise<void> | void;
}) {
  const {
    activeTabId,
    browserSurfaceRef,
    setBrowserBounds,
    sidebarOpen,
    sidebarWidth,
    surfaceMode,
  } = params;

  useEffect(() => {
    const element = browserSurfaceRef.current;

    if (surfaceMode !== "browser" || !element) {
      void setBrowserBounds({ x: 0, y: 0, width: 0, height: 0 });
      return;
    }

    let frameId = 0;
    const syncBounds = () => {
      cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect();
        void setBrowserBounds({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        });
      });
    };

    syncBounds();

    const observer = new ResizeObserver(syncBounds);
    observer.observe(element);
    window.addEventListener("resize", syncBounds);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener("resize", syncBounds);
    };
  }, [activeTabId, browserSurfaceRef, setBrowserBounds, sidebarOpen, sidebarWidth, surfaceMode]);
}
