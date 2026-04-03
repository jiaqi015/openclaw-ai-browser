import { useEffect, useRef, useState } from "react";

export function useBrowserMenuState() {
  const [isBrowserMenuOpen, setIsBrowserMenuOpen] = useState(false);
  const browserMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (browserMenuRef.current && !browserMenuRef.current.contains(event.target as Node)) {
        setIsBrowserMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return {
    isBrowserMenuOpen,
    setIsBrowserMenuOpen,
    browserMenuRef,
  };
}
