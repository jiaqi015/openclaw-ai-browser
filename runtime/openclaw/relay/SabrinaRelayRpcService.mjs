import crypto from "node:crypto";
import { getOpenClawTransportContext } from "../OpenClawTransportContext.mjs";
import { getSabrinaRelayPairingState } from "../SabrinaRemotePairingService.mjs";
import {
  listSabrinaRelayEnvelopes,
  sendSabrinaRelayEnvelope,
} from "./SabrinaRelayClient.mjs";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildRequestId() {
  return `relay-rpc-${crypto.randomUUID()}`;
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export async function resolveSabrinaRelayRpcSession(
  params = {},
  context = getOpenClawTransportContext(),
) {
  const relayUrl = `${params?.relayUrl ?? context?.relayUrl ?? ""}`.trim();
  const connectCode = `${params?.connectCode ?? context?.connectCode ?? ""}`.trim();
  if (!relayUrl) {
    throw new Error("relay-paired 缺少 relay URL。");
  }
  if (!connectCode) {
    throw new Error("relay-paired 缺少连接码。");
  }

  const pairingState = await getSabrinaRelayPairingState({
    relayUrl,
    connectCode,
  });
  const session =
    pairingState?.active ??
    (Array.isArray(pairingState?.sessions)
      ? pairingState.sessions.find((entry) => entry?.status === "active")
      : null) ??
    null;

  if (!session) {
    throw new Error("当前连接码还没有被远端 OpenClaw 认领。");
  }
  if (session.status !== "active") {
    if (session.status === "expired") {
      throw new Error("连接码已过期，请重新生成。");
    }
    if (session.status === "rejected") {
      throw new Error("连接码已被拒绝，请重新生成。");
    }
    throw new Error("当前连接码还没有进入可用状态。");
  }
  if (!`${session.sessionId ?? ""}`.trim()) {
    throw new Error("远端 OpenClaw 已认领连接码，但 relay session 尚未就绪。");
  }

  return {
    relayUrl,
    connectCode,
    pairingState,
    session,
    sessionId: `${session.sessionId}`.trim(),
  };
}

export async function invokeSabrinaRelayRpc(params = {}) {
  const {
    method,
    requestId = buildRequestId(),
    timeoutMs = 4_000,
    pollIntervalMs = 250,
  } = params ?? {};
  const normalizedMethod = `${method ?? ""}`.trim();
  if (!normalizedMethod) {
    throw new Error("缺少 relay rpc method。");
  }

  const session = await resolveSabrinaRelayRpcSession(params);
  const responseDeadline = Date.now() + Math.max(500, Math.trunc(Number(timeoutMs) || 0));
  const outbound = await sendSabrinaRelayEnvelope(session.relayUrl, session.sessionId, {
    from: "browser",
    to: "openclaw",
    type: "rpc.request",
    payload: {
      kind: "rpc.request",
      requestId,
      method: normalizedMethod,
      params:
        params?.params && typeof params.params === "object" ? params.params : {},
    },
  });
  let afterSeq = Number(outbound?.envelope?.seq ?? 0) || 0;

  while (Date.now() < responseDeadline) {
    const inbox = await listSabrinaRelayEnvelopes(session.relayUrl, session.sessionId, {
      recipient: "browser",
      afterSeq,
    });
    const envelopes = Array.isArray(inbox?.envelopes) ? inbox.envelopes : [];
    for (const envelope of envelopes) {
      afterSeq = Math.max(afterSeq, Number(envelope?.seq ?? 0) || 0);
      const payload =
        envelope?.payload && typeof envelope.payload === "object"
          ? envelope.payload
          : null;
      if (
        envelope?.type !== "rpc.response" ||
        envelope?.from !== "openclaw" ||
        payload?.kind !== "rpc.response" ||
        `${payload?.requestId ?? ""}`.trim() !== requestId
      ) {
        continue;
      }

      if (payload.ok === false) {
        throw new Error(
          `${payload?.error ?? "远端 OpenClaw relay rpc 执行失败。"}`
            .trim() || "远端 OpenClaw relay rpc 执行失败。",
        );
      }

      return {
        ok: true,
        requestId,
        relayUrl: session.relayUrl,
        sessionId: session.sessionId,
        session: session.session,
        envelope,
        result: payload?.result ?? null,
      };
    }

    await sleep(Math.max(50, Math.trunc(Number(pollIntervalMs) || 0)));
  }

  throw new Error(`等待远端 OpenClaw 响应超时：${normalizedMethod}`);
}

export async function probeSabrinaRelayRpc(params = {}) {
  try {
    const response = await invokeSabrinaRelayRpc({
      ...params,
      method: "rpc.ping",
      timeoutMs: params?.timeoutMs ?? 2_000,
      pollIntervalMs: params?.pollIntervalMs ?? 200,
    });
    return {
      ok: true,
      detail:
        `${response?.result?.worker ?? "remote-worker"} 已响应 relay 命令通道`
          .trim() || "relay 命令通道可用。",
      result: response.result ?? null,
    };
  } catch (error) {
    return {
      ok: false,
      detail: getErrorMessage(error),
    };
  }
}
