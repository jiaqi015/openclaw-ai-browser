import {
  getOpenClawConfig,
  resolveOpenClawConfigPath,
  resolveOpenClawStateDir,
} from "./OpenClawConfigCache.mjs";
import { probeOpenClawTransport } from "./OpenClawClient.mjs";
import {
  getLocalDeviceStatus,
  getLocalGatewayStatus,
  getLocalModelState,
  getLocalPairingStatus,
  getLocalSkillCatalog,
} from "./OpenClawManager.mjs";
import { pathExists } from "./BindingSetupService.mjs";
import { sabrinaBrowserAgentId } from "./OpenClawAgentBootstrapService.mjs";
import { getBrowserMemoryStats } from "./SabrinaMemoryBridgeService.mjs";
import { getTurnJournalStats } from "../turns/TurnJournalStore.mjs";
import {
  getOpenClawRemoteTargetRef,
  getOpenClawTransportLabel,
  isOpenClawRemoteTransportContext,
  setOpenClawTransportContext,
} from "./OpenClawTransportContext.mjs";
import { normalizeConnectionConfig, normalizeTarget } from "./OpenClawStateModel.mjs";

function toCheck(id, label, ok, detail, extra = {}) {
  return {
    id,
    label,
    status: ok ? "pass" : "fail",
    detail: `${detail ?? ""}`.trim(),
    ...extra,
  };
}

function toWarnCheck(id, label, detail, extra = {}) {
  return {
    id,
    label,
    status: "warn",
    detail: `${detail ?? ""}`.trim(),
    ...extra,
  };
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function buildRelayWorkerCommand(connectionConfig = {}) {
  const relayUrl = `${connectionConfig?.relayUrl ?? ""}`.trim();
  const connectCode = `${connectionConfig?.connectCode ?? ""}`.trim();
  if (!relayUrl || !connectCode) {
    return "";
  }

  return [
    "openclaw sabrina relay-worker",
    `--relay-url ${relayUrl}`,
    `--connect-code ${connectCode}`,
    `${connectionConfig?.label ?? ""}`.trim()
      ? `--label ${JSON.stringify(`${connectionConfig.label}`.trim())}`
      : "",
    `${connectionConfig?.agentId ?? ""}`.trim()
      ? `--agent ${`${connectionConfig.agentId}`.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function buildOpenClawDoctorReport(params = {}) {
  const target = normalizeTarget(params?.target ?? params?.state?.selectedTarget);
  const connectionConfig = normalizeConnectionConfig(
    {
      ...params?.state?.connectionConfig,
      ...params?.connectionConfig,
      transport: target,
    },
    target,
  );
  setOpenClawTransportContext(connectionConfig);
  const isRemoteTransport = isOpenClawRemoteTransportContext(connectionConfig);

  const checks = [];
  const configPath = resolveOpenClawConfigPath();
  const stateDir = resolveOpenClawStateDir();
  const remoteTargetRef = getOpenClawRemoteTargetRef(connectionConfig);
  const configExists = isRemoteTransport
    ? Boolean(remoteTargetRef)
    : await pathExists(configPath);
  checks.push(
    toCheck(
      "config",
      isRemoteTransport ? "远程控制面" : "OpenClaw 配置",
      configExists,
      isRemoteTransport
        ? configExists
          ? remoteTargetRef
          : "尚未提供远程控制面配置"
        : configExists
          ? configPath
          : `未找到 ${configPath}`,
    ),
  );

  let config = null;
  if (!isRemoteTransport) {
    try {
      config = await getOpenClawConfig(true);
    } catch (error) {
      checks.push(toWarnCheck("config-read", "读取配置", getErrorMessage(error)));
    }
  }

  const browserAgentRecord = config?.getAgentRecord(sabrinaBrowserAgentId) ?? null;
  let resolvedModelState = null;
  if (isRemoteTransport) {
    const remoteProbe = await probeOpenClawTransport().catch((error) => ({
      ok: false,
      detail: getErrorMessage(error),
    }));
    checks.push(
      toCheck(
        "remote-driver",
        "远程 transport",
        remoteProbe.ok,
        remoteProbe.ok
          ? `${connectionConfig.driver} · ${remoteTargetRef ?? getOpenClawTransportLabel(connectionConfig)}`
          : remoteProbe.detail || "远程 transport 当前不可达",
      ),
    );

    if (connectionConfig.driver === "relay-paired") {
      const relayWorkerCommand = buildRelayWorkerCommand(connectionConfig);
      checks.push(
        remoteProbe.ok
          ? toCheck("relay-worker", "Relay worker", true, "远端 relay worker 已响应。")
          : toWarnCheck(
              "relay-worker",
              "Relay worker",
              relayWorkerCommand
                ? `在远端 OpenClaw 机器运行：${relayWorkerCommand}`
                : "补全 relay 地址和连接码后，就能生成远端 worker 命令。",
            ),
      );
    }

    if (!remoteProbe.ok) {
      try {
        const memoryStats = await getBrowserMemoryStats();
        checks.push(
          toCheck(
            "memory-bridge",
            "浏览器记忆桥",
            true,
            `${memoryStats.count} 条记录 · ${memoryStats.path}`,
          ),
        );
      } catch (error) {
        checks.push(toWarnCheck("memory-bridge", "浏览器记忆桥", getErrorMessage(error)));
      }

      const failures = checks.filter((check) => check.status === "fail");
      const warnings = checks.filter((check) => check.status === "warn");
      return {
        ok: failures.length === 0,
        target,
        transport: connectionConfig.transport,
        transportLabel: getOpenClawTransportLabel(connectionConfig),
        profile: connectionConfig.profile,
        stateDir,
        configPath,
        checkCount: checks.length,
        failureCount: failures.length,
        warningCount: warnings.length,
        checks,
      };
    }

    try {
      const modelState = await getLocalModelState(connectionConfig.agentId || "");
      resolvedModelState = modelState;
      checks.push(
        toCheck(
          "browser-agent",
          "远程 Agent",
          true,
          `${modelState.agentId} 可用`,
        ),
      );
    } catch (error) {
      checks.push(toWarnCheck("browser-agent", "远程 Agent", getErrorMessage(error)));
    }
  } else {
    checks.push(
      browserAgentRecord
        ? toCheck(
            "browser-agent",
            "浏览器专用 Agent",
            true,
            `${sabrinaBrowserAgentId} 已存在`,
          )
        : toWarnCheck(
            "browser-agent",
            "浏览器专用 Agent",
            `${sabrinaBrowserAgentId} 尚未创建，连接时会自动补齐。`,
          ),
    );
  }

  try {
    const gatewayStatus = await getLocalGatewayStatus();
    checks.push(
      toCheck(
        "gateway",
        "Gateway",
        gatewayStatus.ok,
        gatewayStatus.ok
          ? `${gatewayStatus.serviceStatus} · ${gatewayStatus.bindHost}:${gatewayStatus.port}`
          : gatewayStatus.warnings[0] || "Gateway 未就绪",
      ),
    );
  } catch (error) {
    checks.push(toCheck("gateway", "Gateway", false, getErrorMessage(error)));
  }

  if (isRemoteTransport || browserAgentRecord) {
    try {
      const modelState = resolvedModelState ?? await getLocalModelState(
        isRemoteTransport ? connectionConfig.agentId || "" : sabrinaBrowserAgentId,
      );
      const desired = modelState.desiredModel || "未配置";
      const applied = modelState.appliedModel || "未解析";
      const modelOk = Boolean(modelState.appliedModel);
      checks.push(
        toCheck(
          "models",
          "模型同步",
          modelOk,
          `desired=${desired} · applied=${applied} · ${modelState.models.length} 个模型`,
        ),
      );
    } catch (error) {
      checks.push(toWarnCheck("models", "模型同步", getErrorMessage(error)));
    }
  }

  try {
    const skillCatalog = await getLocalSkillCatalog();
    const capabilitySourceCounts = skillCatalog.summary?.capabilitySourceCounts ?? {};
    checks.push(
      toCheck(
        "skills",
        "浏览器技能目录",
        true,
        `${skillCatalog.summary.ready}/${skillCatalog.summary.total} ready · declared=${capabilitySourceCounts.declared ?? 0} · overlay=${capabilitySourceCounts.overlay ?? 0} · heuristic=${capabilitySourceCounts.heuristic ?? 0}`,
      ),
    );
  } catch (error) {
    checks.push(toWarnCheck("skills", "浏览器技能目录", getErrorMessage(error)));
  }

  if (isRemoteTransport) {
    checks.push(
      toCheck(
        "pairing",
        "远程连接模式",
        Boolean(remoteTargetRef),
        remoteTargetRef
          ? `当前远程 driver：${connectionConfig.driver} · ${remoteTargetRef}`
          : "未配置远程控制面",
      ),
    );
  } else {
    try {
      const pairingStatus = await getLocalPairingStatus();
      const deviceStatus = await getLocalDeviceStatus();
      if (pairingStatus.requestCount > 0 || deviceStatus.pendingCount > 0) {
        checks.push(
          toWarnCheck(
            "pairing",
            "OpenClaw 通用配对/设备队列",
            `${pairingStatus.requestCount} 个配对请求 · ${deviceStatus.pendingCount} 个待批准设备`,
          ),
        );
      } else {
        checks.push(toCheck("pairing", "OpenClaw 通用配对/设备队列", true, "当前没有待处理请求"));
      }
    } catch (error) {
      checks.push(toWarnCheck("pairing", "OpenClaw 通用配对/设备队列", getErrorMessage(error)));
    }
  }

  try {
    const memoryStats = await getBrowserMemoryStats();
    checks.push(
      toCheck(
        "memory-bridge",
        "浏览器记忆桥",
        true,
        `${memoryStats.count} 条记录 · ${memoryStats.path}`,
      ),
    );
  } catch (error) {
    checks.push(toWarnCheck("memory-bridge", "浏览器记忆桥", getErrorMessage(error)));
  }

  try {
    const journalStats = getTurnJournalStats();
    checks.push(
      toCheck(
        "turn-journal",
        "Turn journal",
        true,
        `${journalStats.count} 条记录 · latest=${journalStats.latestStatus ?? "n/a"} · ${journalStats.path}`,
      ),
    );
  } catch (error) {
    checks.push(toWarnCheck("turn-journal", "Turn journal", getErrorMessage(error)));
  }

  const failures = checks.filter((check) => check.status === "fail");
  const warnings = checks.filter((check) => check.status === "warn");

  return {
    ok: failures.length === 0,
    target,
    transport: connectionConfig.transport,
    transportLabel: getOpenClawTransportLabel(connectionConfig),
    profile: connectionConfig.profile,
    stateDir,
    configPath,
    checkCount: checks.length,
    failureCount: failures.length,
    warningCount: warnings.length,
    checks,
  };
}
