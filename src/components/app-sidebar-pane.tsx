import type { ComponentProps } from "react";
import { AnimatePresence } from "motion/react";
import { AiSidebar } from "./ai-sidebar";

type AppSidebarPaneProps = ComponentProps<typeof AiSidebar> & {
  open: boolean;
  surfaceMode: string;
};

export function AppSidebarPane({
  open,
  surfaceMode,
  ...sidebarProps
}: AppSidebarPaneProps) {
  return (
    <AnimatePresence initial={false}>
      {open && surfaceMode === "browser" ? <AiSidebar {...sidebarProps} /> : null}
    </AnimatePresence>
  );
}
