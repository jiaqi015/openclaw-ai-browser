import { type MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from "react";

export function useSidebarResize(initialWidth = 380) {
  const [sidebarWidth, setSidebarWidth] = useState(initialWidth);
  const [isDraggingState, setIsDraggingState] = useState(false);
  const isDragging = useRef(false);

  useEffect(() => {
    if (!isDraggingState) {
      return;
    }

    function handleMouseMove(event: MouseEvent) {
      const nextWidth = window.innerWidth - event.clientX;
      if (nextWidth >= 320 && nextWidth <= 800) {
        setSidebarWidth(nextWidth);
      }
    }

    function handleMouseUp() {
      isDragging.current = false;
      setIsDraggingState(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "default";
    }

    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.style.cursor = "default";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingState]);

  function handleResizeStart(event: ReactMouseEvent) {
    event.preventDefault();
    setIsDraggingState(true);
  }

  return {
    sidebarWidth,
    isDraggingState,
    handleResizeStart,
  };
}
