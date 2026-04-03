import fs from "node:fs/promises";

export function buildBindingSetupState(params) {
  const {
    target = "local",
    configExists = false,
    hasAgent = false,
    gatewayReachable = false,
    hasSkillCatalog = false,
    skillCount = 0,
    note = "",
    statusOverride = "",
  } = params ?? {};

  const steps = [
    {
      id: "install-bridge",
      title: "检查龙虾环境",
      description: "确认 OpenClaw 可用。",
      status: configExists ? "completed" : "pending",
    },
    {
      id: "ensure-agent",
      title: "准备浏览器代理",
      description: "准备浏览器专用 agent。",
      status: hasAgent ? "completed" : configExists ? "in_progress" : "pending",
    },
    {
      id: "load-skills",
      title: "读取技能能力",
      description: hasSkillCatalog
        ? `已读取 ${skillCount} 项技能。`
        : "同步当前可用技能。",
      status: hasSkillCatalog ? "completed" : hasAgent ? "in_progress" : "pending",
    },
    {
      id: "pair-browser",
      title: "授权 Sabrina 连接",
      description: "确认 Sabrina 已接入。",
      status: gatewayReachable ? "completed" : hasAgent ? "in_progress" : "pending",
    },
  ];

  if (target === "remote") {
    return {
      status: statusOverride || "degraded",
      target,
      title: "连接远程龙虾",
      description: "远程连接稍后开放。",
      note:
        note || "先完成本机连接即可。",
      primaryActionLabel: undefined,
      secondaryActionLabel: "本机优先",
      steps,
    };
  }

  const status =
    statusOverride ||
    (gatewayReachable && hasAgent
      ? "ready"
      : configExists
        ? "degraded"
        : "idle");

  return {
    status,
    target,
    title: gatewayReachable && hasAgent ? "本机 OpenClaw 已接入" : "连接本机 OpenClaw",
    description:
      gatewayReachable && hasAgent
        ? "当前浏览器已接入这台机器上的 OpenClaw。"
        : "接入后可直接复用模型、技能和记忆。",
    note,
    primaryActionLabel: gatewayReachable && hasAgent ? "重新检查" : "开始连接",
    secondaryActionLabel: gatewayReachable && hasAgent ? "断开连接" : "远程连接稍后开放",
    steps,
  };
}

export async function pathExists(targetPath) {
  if (!targetPath) {
    return false;
  }

  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
