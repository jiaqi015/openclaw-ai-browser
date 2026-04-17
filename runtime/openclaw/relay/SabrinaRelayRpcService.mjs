import crypto from "node:crypto";
import { getOpenClawTransportContext } from "../OpenClawTransportContext.mjs";
import { getSabrinaRelayPairingState } from "../SabrinaRemotePairingService.mjs";
import {
  listSabrinaRelayEnvelopes,
  sendSabrinaRelayEnvelope,
} from "./SabrinaRelayClient.mjs";
import { recordRpcLatency, recordRuntimeEvent } from "../../shared/SabrinaLoggerService.mjs";

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
    throw new Error("relay-paired 缺少连接地址。");
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
  let retryCount = 0;
  const maxRetries = 3;

  while (Date.now() < responseDeadline) {
    try {
      const session = await resolveSabrinaRelayRpcSession(params);
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

      // 等待响应的内部循环
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
            envelope?.type === "rpc.response" &&
            envelope?.from === "openclaw" &&
            payload?.kind === "rpc.response" &&
            `${payload?.requestId ?? ""}`.trim() === requestId
          ) {
            if (payload.ok === false) {
              throw new Error(payload?.error || "远端 OpenClaw relay rpc 执行失败。");
            }
            return {
              ok: true,
              requestId,
              relayUrl: session.relayUrl,
              sessionId: session.sessionId,
              result: payload?.result ?? null,
            };
          }
        }
        await sleep(Math.max(50, Math.trunc(Number(pollIntervalMs) || 0)));
      }
    } catch (err) {
      retryCount++;
      if (retryCount >= maxRetries || Date.now() >= responseDeadline) throw err;
      console.warn(`[RelayRPC] Attempt ${retryCount} failed, retrying...`, err);
      await sleep(1000); // 抖动退避
    }
  }

  const duration = Date.now() - (responseDeadline - Math.max(500, Math.trunc(Number(timeoutMs) || 0)));
  await recordRpcLatency(normalizedMethod, duration);
  
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

export async function listenSabrinaRelayRpc(handlers = {}, params = {}) {
  const {
    pollIntervalMs = 500,
    signal,
    identity = "browser",
    peerIdentity = "openclaw",
  } = params;
  
  const session = await resolveSabrinaRelayRpcSession(params);
  let afterSeq = 0;

  // Initialize afterSeq to current end of stream to only process NEW requests
  const initialInbox = await listSabrinaRelayEnvelopes(session.relayUrl, session.sessionId, {
    recipient: identity,
  });
  if (Array.isArray(initialInbox?.envelopes)) {
    initialInbox.envelopes.forEach(e => {
      afterSeq = Math.max(afterSeq, Number(e?.seq ?? 0) || 0);
    });
  }

  while (!signal?.aborted) {
    try {
      const inbox = await listSabrinaRelayEnvelopes(session.relayUrl, session.sessionId, {
        recipient: identity,
        afterSeq,
      });
      
      const envelopes = Array.isArray(inbox?.envelopes) ? inbox.envelopes : [];
      for (const envelope of envelopes) {
        afterSeq = Math.max(afterSeq, Number(envelope?.seq ?? 0) || 0);
        
        const payload = envelope?.payload && typeof envelope.payload === "object" ? envelope.payload : null;
        if (
          envelope?.type !== "rpc.request" || 
          envelope?.from !== peerIdentity ||
          payload?.kind !== "rpc.request" ||
          !payload?.requestId ||
          !payload?.method
        ) {
          continue;
        }

        const method = payload.method;
        const requestId = payload.requestId;
        const handler = handlers[method];

        if (typeof handler !== "function") {
          await sendSabrinaRelayEnvelope(session.relayUrl, session.sessionId, {
            from: identity,
            to: peerIdentity,
            type: "rpc.response",
            payload: {
              kind: "rpc.response",
              requestId,
              ok: false,
              error: `Method not found: ${method}`,
            }
          });
          continue;
        }

        // Execute handler and reply
        try {
          const result = await handler(payload.params ?? {}, { envelope, session });
          await sendSabrinaRelayEnvelope(session.relayUrl, session.sessionId, {
            from: identity,
            to: peerIdentity,
            type: "rpc.response",
            payload: {
              kind: "rpc.response",
              requestId,
              ok: true,
              result,
            }
          });
        } catch (handlerErr) {
          await sendSabrinaRelayEnvelope(session.relayUrl, session.sessionId, {
            from: identity,
            to: peerIdentity,
            type: "rpc.response",
            payload: {
              kind: "rpc.response",
              requestId,
              ok: false,
              error: getErrorMessage(handlerErr),
            }
          });
        }
      }
    } catch (pollErr) {
      console.error("[RelayRPC] Poll internal error:", pollErr);
    }
    
    await sleep(Math.max(100, Math.trunc(Number(pollIntervalMs) || 0)));
  }
}

/**
 * 创建一个符合 Brain-Hands 协议的 Relay 传输适配器
 */
export async function createRelayMessenger(params = {}) {
  const { identity = "browser", peerIdentity = "openclaw" } = params;
  const session = await resolveSabrinaRelayRpcSession(params);
  const abortController = new AbortController();

  return {
    identity,
    peerIdentity,
    session,
    
    // 发起 RPC 调用
    async call(method, rpcParams) {
      const response = await invokeSabrinaRelayRpc({
        ...params,
        ...rpcParams,
        method
      });
      return response.result;
    },

    // 启动监听流程
    async listen(handlers) {
      return listenSabrinaRelayRpc(handlers, {
        ...params,
        identity,
        peerIdentity,
        signal: abortController.signal
      });
    },

    // 资源清理
    close() {
      abortController.abort();
    }
  };
}
