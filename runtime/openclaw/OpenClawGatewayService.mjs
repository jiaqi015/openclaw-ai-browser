import net from "node:net";
import { spawn } from "node:child_process";
import { getOpenClawConfig } from "./OpenClawConfigCache.mjs";
import { execOpenClawCommand, execOpenClawJson } from "./OpenClawClient.mjs";
import {
  buildOpenClawExecArgs,
  buildOpenClawExecOptions,
  getOpenClawTransportContext,
} from "./OpenClawTransportContext.mjs";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function probeTcpPort(host, port, timeoutMs = 900) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (value) => {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

async function getHealthSummary() {
  try {
    const { stdout } = await execOpenClawCommand(["health"], {
      timeout: 3500,
      maxBuffer: 1024 * 256,
    });

    const lines = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""))
      .filter((line) => !line.startsWith("[plugins]"));

    return lines.slice(0, 2).join(" · ");
  } catch {
    return "";
  }
}

export async function getGatewayHealthOk(config) {
  const gateway = config.getGatewayEndpoint();
  const url = gateway.url;

  let headers = {};
  try {
    headers = config.getGatewayAuthHeaders();
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(url, {
      method: "OPTIONS",
      headers,
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      return { ok: false, detail: "Gateway 鉴权失败" };
    }

    if (response.status === 404) {
      return { ok: false, detail: "Gateway HTTP chatCompletions 未启用" };
    }

    return { ok: true, detail: "" };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function formatGatewayCommandSummary(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const message = `${payload.message ?? ""}`.trim();
  const hints = Array.isArray(payload.hints)
    ? payload.hints
        .map((hint) => `${hint ?? ""}`.trim())
        .filter(Boolean)
        .slice(0, 2)
    : [];

  return [message, ...hints].filter(Boolean).join("；");
}

async function waitForGatewayReachable(config, timeoutMs = 15000) {
  const gateway = config.getGatewayEndpoint();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await probeTcpPort(gateway.host, gateway.port, 600)) {
      return true;
    }

    await sleep(500);
  }

  return false;
}

async function runGatewayServiceCommand(command) {
  try {
    const payload = await execOpenClawJson(["gateway", command, "--json"], {
      timeout: 15000,
      maxBuffer: 1024 * 256,
      retries: 0,
    });

    return {
      ok: true,
      payload,
      summary: formatGatewayCommandSummary(payload),
    };
  } catch (error) {
    return {
      ok: false,
      payload: null,
      summary: error instanceof Error ? error.message : String(error),
    };
  }
}

async function spawnDetachedGateway(config) {
  const gateway = config.getGatewayEndpoint();
  const context = getOpenClawTransportContext();
  const child = spawn(
    "openclaw",
    buildOpenClawExecArgs(["gateway", "run", "--port", `${gateway.port}`], context),
    buildOpenClawExecOptions(
      {
        detached: true,
        stdio: "ignore",
      },
      context,
    ),
  );
  child.unref();

  return waitForGatewayReachable(config, 12000);
}

export async function recoverLocalGateway(config) {
  const currentHealth = await getGatewayHealthOk(config);
  if (currentHealth.ok) {
    return {
      ok: true,
      mode: "already-running",
      note: "",
    };
  }

  const attempts = [];
  if (currentHealth.detail) {
    attempts.push(currentHealth.detail);
  }

  const restartResult = await runGatewayServiceCommand("restart");
  attempts.push(restartResult.summary);
  if ((await getGatewayHealthOk(config)).ok) {
    return {
      ok: true,
      mode: "service-restart",
      note: restartResult.summary,
    };
  }

  const startResult = await runGatewayServiceCommand("start");
  attempts.push(startResult.summary);
  if ((await getGatewayHealthOk(config)).ok) {
    return {
      ok: true,
      mode: "service-start",
      note: startResult.summary,
    };
  }

  try {
    const detachedStarted = await spawnDetachedGateway(config);
    if (detachedStarted && (await getGatewayHealthOk(config)).ok) {
      return {
        ok: true,
        mode: "detached-run",
        note: "已通过本地前台模式拉起龙虾网关。",
      };
    }
  } catch (error) {
    attempts.push(error instanceof Error ? error.message : String(error));
  }

  return {
    ok: false,
    mode: "unreachable",
    note:
      attempts.filter(Boolean).join("；") ||
      "无法恢复本机龙虾网关，请检查本机龙虾安装与启动状态。",
  };
}

export async function restartLocalGateway(config) {
  const recovery = await recoverLocalGateway(config);
  return recovery.ok;
}

export async function ensureChatCompletionsEndpoint() {
  const config = await getOpenClawConfig();
  if (config.isChatCompletionsEnabled()) {
    return config;
  }

  await execOpenClawCommand(
    ["config", "set", "gateway.http.endpoints.chatCompletions.enabled", "true", "--strict-json"],
    {
      timeout: 8000,
      maxBuffer: 1024 * 256,
    },
  );

  config.setChatCompletionsEnabled();
  const nextConfig = await getOpenClawConfig(true);
  await restartLocalGateway(nextConfig);
  return nextConfig;
}

function extractChatCompletionText(payload) {
  const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null;
  const content = choice?.message?.content;

  if (typeof content === "string" && content.trim()) {
    return content.trim();
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (typeof part?.text === "string") {
          return part.text;
        }

        return "";
      })
      .join("")
      .trim();

    if (text) {
      return text;
    }
  }

  return "";
}

export async function runGatewayChatCompletion(params, options = {}) {
  const config = await ensureChatCompletionsEndpoint();
  const gateway = config.getGatewayEndpoint();
  const model = typeof params?.model === "string" ? params.model.trim() : "";
  const sessionKey =
    typeof params?.sessionKey === "string" && params.sessionKey.trim()
      ? params.sessionKey.trim()
      : "main";
  const agentId =
    typeof params?.agentId === "string" && params.agentId.trim()
      ? params.agentId.trim()
      : `${options?.defaultAgentId ?? "saburina-browser"}`.trim();
  const message = typeof params?.message === "string" ? params.message.trim() : "";

  if (!message) {
    throw new Error("消息不能为空");
  }

  const headers = {
    "Content-Type": "application/json",
    ...config.getGatewayAuthHeaders(),
    "x-openclaw-session-key": sessionKey,
  };
  if (model) {
    headers["x-openclaw-model"] = model;
  }

  const response = await fetch(`http://${gateway.host}:${gateway.port}/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: `openclaw/${agentId}`,
      user: sessionKey,
      messages: [
        {
          role: "user",
          content: message,
        },
      ],
    }),
  });
  const rawText = await response.text();

  let payload = null;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const messageText =
      payload?.error?.message ||
      rawText.trim() ||
      `OpenClaw Gateway 请求失败 (${response.status})`;
    throw new Error(messageText);
  }

  return {
    text: extractChatCompletionText(payload) || "OpenClaw 没有返回可显示的文本。",
    sessionId: null,
    model,
    provider: null,
    durationMs: null,
  };
}

export { getHealthSummary };
