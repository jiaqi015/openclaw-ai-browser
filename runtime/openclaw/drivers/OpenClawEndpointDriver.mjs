import {
  getOpenClawTransportContext,
} from "../OpenClawTransportContext.mjs";

export const openClawEndpointDriver = Object.freeze({
  id: "endpoint",
  capabilities: Object.freeze({
    remote: true,
    remoteCliExecution: true, // We'll assume the gateway can handle RPC calls that mimic CLI
    sessionTrace: false,
    gatewayHttpManagement: true,
  }),
  buildInvocation(args = [], options = {}, context) {
    // For now, if we still need to run a local command even in endpoint mode 
    // (e.g. for gateway management or legacy skills), we fallback to local openclaw.
    // However, the intention of the endpoint driver is to eventually shift to fetch.
    return {
      command: "openclaw",
      args: ["--endpoint", context.endpointUrl, "--token", context.accessToken || "", ...args],
      options: {
        ...options,
        env: {
          ...process.env,
          ...(options?.env ?? {}),
          OPENCLAW_ENDPOINT: context.endpointUrl,
          OPENCLAW_TOKEN: context.accessToken || "",
        },
      },
    };
  },
  async probeTransport(options = {}, context) {
    if (!context?.endpointUrl) {
      return {
        ok: false,
        detail: "未配置连接地址 (Endpoint URL)。",
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout ?? 5000);

    try {
      const response = await fetch(context.endpointUrl, {
        method: "OPTIONS",
        headers: context.accessToken ? {
          "Authorization": `Bearer ${context.accessToken}`
        } : {},
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        return { ok: false, detail: "连接成功，但鉴权失败 (Invalid Token)。" };
      }

      if (response.status >= 500) {
        return { ok: false, detail: `远端服务内部错误 (${response.status})。` };
      }

      return { ok: true, detail: "已连接到远端 OpenClaw 服务。" };
    } catch (error) {
      return {
        ok: false,
        detail: `无法访问连接地址：${error instanceof Error ? error.message : String(error)}`,
      };
    } finally {
      clearTimeout(timeout);
    }
  },
});
