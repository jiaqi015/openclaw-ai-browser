import type { ReactNode } from "react";

export type SidebarModelOption = {
  id: string;
  label: string;
  desc: string;
};

export type SidebarMessage = {
  messageId: string;
  role: "user" | "assistant" | "system" | "error";
  text: string;
  mode?: "agent" | "chat" | "claw" | "gentab";
  skillTrace?: SabrinaSkillTrace;
};

export type SidebarQuickAction = {
  id: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
};

export type SidebarComposerSkill = {
  name: string;
  label: string;
};
