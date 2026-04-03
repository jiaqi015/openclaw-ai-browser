import { AnimatePresence, motion } from "motion/react";
import type { BrowserMenuCommand, SystemEntryIconName } from "../application/browser-surface";
import { SystemEntryIcon } from "./system-entry-icon";

const PRIMARY_ITEMS: Array<{ command: BrowserMenuCommand; label: string; icon: SystemEntryIconName }> = [
  { command: "history", label: "历史浏览", icon: "history" },
  { command: "bookmarks", label: "书签", icon: "bookmarks" },
  { command: "downloads", label: "下载内容", icon: "downloads" },
  { command: "diagnostics", label: "诊断中心", icon: "diagnostics" },
];

const SETTINGS_ITEMS: Array<{ command: BrowserMenuCommand; label: string; icon: SystemEntryIconName }> = [
  { command: "general-settings", label: "设置", icon: "general-settings" },
  { command: "settings", label: "龙虾连接", icon: "settings" },
];

export function BrowserMenuDropdown(props: {
  open: boolean;
  onClose: () => void;
  onSelect: (command: BrowserMenuCommand) => void;
}) {
  const { onClose, onSelect, open } = props;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="surface-menu no-drag absolute right-0 top-full mt-2 w-48 rounded-xl border py-1.5 z-50 overflow-hidden"
        >
          {PRIMARY_ITEMS.map((item) => (
            <BrowserMenuItem
              key={item.command}
              command={item.command}
              label={item.label}
              icon={item.icon}
              onClose={onClose}
              onSelect={onSelect}
            />
          ))}
          <div className="surface-menu-separator h-px my-1.5 mx-2" />
          <BrowserMenuItem
            command="clear-history"
            label="删除浏览记录"
            icon="clear-history"
            tone="danger"
            onClose={onClose}
            onSelect={onSelect}
          />
          <div className="surface-menu-separator h-px my-1.5 mx-2" />
          {SETTINGS_ITEMS.map((item) => (
            <BrowserMenuItem
              key={item.command}
              command={item.command}
              label={item.label}
              icon={item.icon}
              onClose={onClose}
              onSelect={onSelect}
            />
          ))}
          <div className="surface-menu-separator h-px my-1.5 mx-2" />
          <BrowserMenuItem
            command="download-latest"
            label="获取最新版本"
            icon="download-latest"
            tone="accent"
            onClose={onClose}
            onSelect={onSelect}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function BrowserMenuItem(props: {
  command: BrowserMenuCommand;
  label: string;
  icon: SystemEntryIconName;
  onClose: () => void;
  onSelect: (command: BrowserMenuCommand) => void;
  tone?: "default" | "danger" | "accent";
}) {
  const { command, icon, label, onClose, onSelect, tone = "default" } = props;

  return (
    <button
      onClick={() => {
        onClose();
        onSelect(command);
      }}
      className={[
        "w-full px-4 py-2 text-left text-xs font-medium flex items-center gap-2.5 transition-colors",
        tone === "default" ? "surface-menu-item" : "",
        tone === "danger" ? "surface-menu-item surface-menu-item-danger" : "",
        tone === "accent" ? "surface-menu-item surface-menu-item-accent" : "",
      ].join(" ")}
    >
      <SystemEntryIcon name={icon} variant="menu" className="h-[22px] w-[22px]" />
      {label}
    </button>
  );
}
