import {
  getOpenClawConfig,
  resolveOpenClawConfigPath,
  resolveOpenClawStateDir,
} from "./OpenClawConfigCache.mjs";
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
import {
  getOpenClawTransportLabel,
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

  const checks = [];
  const configPath = resolveOpenClawConfigPath();
  const stateDir = resolveOpenClawStateDir();
  const configExists = await pathExists(configPath);
  checks.push(
    toCheck(
      "config",
      "OpenClaw 配置",
      configExists,
      configExists ? configPath : `未找到 ${configPath}`,
    ),
  );

  let config = null;
  try {
    config = await getOpenClawConfig(true);
  } catch (error) {
    checks.push(toWarnCheck("config-read", "读取配置", getErrorMessage(error)));
  }

  const browserAgentRecord = config?.getAgentRecord(sabrinaBrowserAgentId) ?? null;
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

  if (browserAgentRecord) {
    try {
      const modelState = await getLocalModelState(sabrinaBrowserAgentId);
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
    checks.push(
      toCheck(
        "skills",
        "浏览器技能目录",
        true,
        `${skillCatalog.summary.ready}/${skillCatalog.summary.total} ready`,
      ),
    );
  } catch (error) {
    checks.push(toWarnCheck("skills", "浏览器技能目录", getErrorMessage(error)));
  }

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
