import { formatLocalTimestamp } from "./OpenClawPresentationService.mjs";

export function buildLocalPairingStatus(payload = {}, params = {}) {
  const requests = Array.isArray(payload?.requests) ? payload.requests : [];
  const channel = `${params?.channel ?? ""}`.trim();
  const accountId = `${params?.accountId ?? ""}`.trim();

  return {
    channel: `${payload?.channel ?? channel}`.trim() || null,
    requestCount: requests.length,
    requests: requests.map((entry, index) => ({
      requestId:
        `${entry?.requestId ?? entry?.id ?? entry?.code ?? ""}`.trim() ||
        `pairing-${index + 1}`,
      code: `${entry?.code ?? ""}`.trim(),
      accountId: `${entry?.accountId ?? entry?.account ?? accountId}`.trim() || undefined,
      fromLabel:
        `${entry?.fromLabel ?? entry?.from ?? entry?.sender ?? entry?.displayName ?? ""}`.trim() ||
        undefined,
      createdAt:
        typeof entry?.createdAt === "string" && entry.createdAt.trim()
          ? entry.createdAt.trim()
          : undefined,
      createdAtLabel:
        typeof entry?.createdAtMs === "number" || typeof entry?.createdAt === "string"
          ? formatLocalTimestamp(entry?.createdAtMs ?? entry?.createdAt)
          : undefined,
      raw: entry ?? null,
    })),
  };
}

export function buildLocalDeviceStatus(payload = {}) {
  const pending = Array.isArray(payload?.pending) ? payload.pending : [];
  const paired = Array.isArray(payload?.paired) ? payload.paired : [];

  return {
    pendingCount: pending.length,
    pairedCount: paired.length,
    pairedDevices: paired.map((entry) => ({
      deviceId: `${entry?.deviceId ?? ""}`.trim(),
      clientId: `${entry?.clientId ?? ""}`.trim(),
      clientMode: `${entry?.clientMode ?? ""}`.trim(),
      platform: `${entry?.platform ?? ""}`.trim(),
      roles: Array.isArray(entry?.roles)
        ? entry.roles.filter((role) => typeof role === "string" && role.trim())
        : [],
      approvedAt: formatLocalTimestamp(entry?.approvedAtMs ?? entry?.createdAtMs ?? null),
      scopeCount: Array.isArray(entry?.scopes) ? entry.scopes.length : 0,
    })),
  };
}

export function buildLocalGatewayStatus(statusPayload = {}, healthPayload = {}) {
  const auditIssues = Array.isArray(statusPayload?.service?.configAudit?.issues)
    ? statusPayload.service.configAudit.issues
    : [];
  const agents = Array.isArray(healthPayload?.agents) ? healthPayload.agents : [];

  return {
    ok: Boolean(healthPayload?.ok) && Boolean(statusPayload?.rpc?.ok),
    serviceLabel: `${statusPayload?.service?.label ?? ""}`.trim(),
    serviceLoaded: Boolean(statusPayload?.service?.loaded),
    serviceStatus: `${statusPayload?.service?.runtime?.status ?? "unknown"}`.trim() || "unknown",
    bindMode: `${statusPayload?.gateway?.bindMode ?? ""}`.trim(),
    bindHost: `${statusPayload?.gateway?.bindHost ?? ""}`.trim(),
    port: Number(statusPayload?.gateway?.port ?? 0) || 0,
    probeUrl: `${statusPayload?.gateway?.probeUrl ?? ""}`.trim(),
    rpcUrl: `${statusPayload?.rpc?.url ?? ""}`.trim(),
    defaultAgentId: `${healthPayload?.defaultAgentId ?? ""}`.trim(),
    sessionCount: Number(healthPayload?.sessions?.count) || 0,
    agentIds: agents
      .map((agent) => `${agent?.agentId ?? ""}`.trim())
      .filter(Boolean),
    warnings: auditIssues
      .map((issue) => `${issue?.message ?? ""}`.trim())
      .filter(Boolean),
  };
}
