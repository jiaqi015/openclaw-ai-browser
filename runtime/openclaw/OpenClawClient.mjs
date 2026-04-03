import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  getOpenClawTransportContext,
  getOpenClawRemoteTargetRef,
  isOpenClawRemoteTransportContext,
} from "./OpenClawTransportContext.mjs";
import {
  buildOpenClawDriverInvocation,
  getOpenClawDriverId,
  probeOpenClawDriverTransport,
} from "./drivers/OpenClawDriverRegistry.mjs";

const execFileAsync = promisify(execFile);
const transportProbeCache = new Map();
const TRANSPORT_PROBE_TTL_MS = 10_000;

function parseCliJson(stdout) {
  const raw = `${stdout ?? ""}`;
  const trimmed = raw.trim();

  if (!trimmed) {
    throw new Error("OpenClaw CLI 没有返回 JSON 内容。");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter(Boolean);
    const jsonStartIndex = lines.findIndex((line) => {
      const normalized = line.trimStart();
      return (
        normalized.startsWith("{") ||
        (normalized.startsWith("[") && !normalized.startsWith("[plugins]"))
      );
    });

    if (jsonStartIndex >= 0) {
      return JSON.parse(lines.slice(jsonStartIndex).join("\n"));
    }

    throw new Error("OpenClaw CLI 返回了无法解析的 JSON。");
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTransportProbeCacheKey(context) {
  if (!isOpenClawRemoteTransportContext(context)) {
    return "local-cli";
  }
  return `${getOpenClawDriverId(context)}:${getOpenClawRemoteTargetRef(context) ?? ""}:${context?.sshPort ?? ""}:${context?.connectCode ?? ""}:${context?.label ?? ""}`;
}

function buildOpenClawInvocation(args, options = {}, context = getOpenClawTransportContext()) {
  return buildOpenClawDriverInvocation(args, options, context);
}

export async function execOpenClawJson(args, options = {}) {
  const {
    timeout = 8000,
    maxBuffer = 1024 * 1024,
    retries = 1,
    context = getOpenClawTransportContext(),
  } = options;

  let attempt = 0;
  let lastError = null;
  const commandOptions = {
    timeout,
    maxBuffer,
  };

  while (attempt <= retries) {
    try {
      const invocation = buildOpenClawInvocation(args, commandOptions, context);
      const { stdout } = await execFileAsync(
        invocation.command,
        invocation.args,
        invocation.options,
      );
      return parseCliJson(stdout);
    } catch (error) {
      lastError = error;
      if (attempt >= retries) {
        throw error;
      }
      attempt += 1;
      await sleep(180);
    }
  }

  throw lastError ?? new Error("OpenClaw CLI 调用失败");
}

export async function execOpenClawCommand(args, options = {}) {
  const {
    timeout = 8000,
    maxBuffer = 1024 * 1024,
    context = getOpenClawTransportContext(),
  } = options;

  const invocation = buildOpenClawInvocation(
    args,
    {
      timeout,
      maxBuffer,
    },
    context,
  );
  return execFileAsync(invocation.command, invocation.args, invocation.options);
}

export async function probeOpenClawTransport(options = {}) {
  const context = options?.context ?? getOpenClawTransportContext();
  if (!isOpenClawRemoteTransportContext(context)) {
    return {
      ok: true,
      detail: "",
    };
  }

  const cacheKey = getTransportProbeCacheKey(context);
  const now = Date.now();
  const cached = transportProbeCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.result;
  }

  let result = null;
  result = await probeOpenClawDriverTransport(options, context);

  transportProbeCache.set(cacheKey, {
    expiresAt: now + TRANSPORT_PROBE_TTL_MS,
    result,
  });
  return result;
}

export async function execGatewayMethodJson(method, params = {}, options = {}) {
  const args = ["gateway", "call", `${method ?? ""}`.trim(), "--json"];
  if (params && typeof params === "object" && Object.keys(params).length > 0) {
    args.push("--params", JSON.stringify(params));
  }

  return execOpenClawJson(args, {
    timeout: 15000,
    maxBuffer: 1024 * 1024 * 8,
    retries: 0,
    ...options,
  });
}
