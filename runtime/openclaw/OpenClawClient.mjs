import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  buildOpenClawExecArgs,
  buildOpenClawExecOptions,
  getOpenClawTransportContext,
} from "./OpenClawTransportContext.mjs";

const execFileAsync = promisify(execFile);

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

export async function execOpenClawJson(args, options = {}) {
  const {
    timeout = 8000,
    maxBuffer = 1024 * 1024,
    retries = 1,
    context = getOpenClawTransportContext(),
  } = options;

  let attempt = 0;
  let lastError = null;
  const commandArgs = buildOpenClawExecArgs(args, context);
  const commandOptions = buildOpenClawExecOptions(
    {
      timeout,
      maxBuffer,
    },
    context,
  );

  while (attempt <= retries) {
    try {
      const { stdout } = await execFileAsync("openclaw", commandArgs, commandOptions);
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

  return execFileAsync(
    "openclaw",
    buildOpenClawExecArgs(args, context),
    buildOpenClawExecOptions(
      {
        timeout,
        maxBuffer,
      },
      context,
    ),
  );
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
