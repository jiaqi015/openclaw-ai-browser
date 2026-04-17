import fs from "node:fs/promises";
import { getCurrentUiLocale, translate } from "../../shared/localization.mjs";

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
    transportLabel = "",
    sshTarget = "",
  } = params ?? {};
  const locale = getCurrentUiLocale();

  const steps = [
    {
      id: "install-bridge",
      title: translate(locale, "binding.step.install.title"),
      description: translate(locale, "binding.step.install.description"),
      status: configExists ? "completed" : "pending",
    },
    {
      id: "ensure-agent",
      title: translate(locale, "binding.step.ensure.title"),
      description: translate(locale, "binding.step.ensure.description"),
      status: hasAgent ? "completed" : configExists ? "in_progress" : "pending",
    },
    {
      id: "load-skills",
      title: translate(locale, "binding.step.load.title"),
      description: hasSkillCatalog
        ? translate(locale, "binding.step.load.completed", { count: skillCount })
        : translate(locale, "binding.step.load.description"),
      status: hasSkillCatalog ? "completed" : hasAgent ? "in_progress" : "pending",
    },
    {
      id: "pair-browser",
      title: translate(locale, "binding.step.pair.title"),
      description: translate(locale, "binding.step.pair.description"),
      status: gatewayReachable ? "completed" : hasAgent ? "in_progress" : "pending",
    },
  ];

  if (target === "remote") {
    const remoteLabel = `${transportLabel ?? sshTarget ?? ""}`.trim();
    const hasRemoteTarget = Boolean(remoteLabel);
    const remoteReady = hasRemoteTarget && gatewayReachable && hasAgent;

    return {
      status:
        statusOverride ||
        (remoteReady ? "ready" : hasRemoteTarget ? "bootstrapping" : "degraded"),
      target,
      title: remoteReady
        ? translate(locale, "binding.remote.readyTitle")
        : translate(locale, "binding.remote.connectTitle"),
      description: hasRemoteTarget
        ? translate(locale, "binding.remote.description.ready")
        : translate(locale, "binding.remote.description.connect"),
      note:
        note || (hasRemoteTarget ? remoteLabel : translate(locale, "binding.default.remote.note")),
      primaryActionLabel: hasRemoteTarget ? translate(locale, "binding.remote.recheck") : undefined,
      secondaryActionLabel: translate(locale, "binding.default.remote.secondary"),
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
    title: gatewayReachable && hasAgent
      ? translate(locale, "binding.local.readyTitle")
      : translate(locale, "binding.local.connectTitle"),
    description:
      gatewayReachable && hasAgent
        ? translate(locale, "binding.local.readyDescription")
        : translate(locale, "binding.local.connectDescription"),
    note,
    primaryActionLabel: gatewayReachable && hasAgent
      ? translate(locale, "binding.local.recheck")
      : translate(locale, "binding.default.local.primary"),
    secondaryActionLabel: gatewayReachable && hasAgent
      ? translate(locale, "binding.local.disconnect")
      : translate(locale, "binding.local.remoteLater"),
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
