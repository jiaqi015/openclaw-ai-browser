import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  buildOpenClawExecArgs,
  buildOpenClawExecOptions,
  getOpenClawTransportContext,
  isOpenClawSshTransportContext,
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

function shellEscape(value) {
  return `'${`${value ?? ""}`.replace(/'/g, `'\\''`)}'`;
}

function buildSshRemoteCommand(args, context) {
  const commandArgs = buildOpenClawExecArgs(args, context);
  const commandParts = [];
  if (context?.stateDir) {
    commandParts.push(`OPENCLAW_STATE_DIR=${shellEscape(context.stateDir)}`);
  }
  commandParts.push("openclaw");
  for (const entry of commandArgs) {
    commandParts.push(shellEscape(entry));
  }
  return commandParts.join(" ");
}

function buildSshInvocation(args, options, context) {
  const sshArgs = [
    "-o",
    "BatchMode=yes",
    "-o",
    "ConnectTimeout=8",
  ];

  if (Number.isFinite(context?.sshPort) && Number(context.sshPort) > 0) {
    sshArgs.push("-p", `${Math.trunc(Number(context.sshPort))}`);
  }

  if (!context?.sshTarget) {
    throw new Error("远程 OpenClaw 缺少 SSH 目标。");
  }

  sshArgs.push(context.sshTarget, buildSshRemoteCommand(args, context));

  return {
    command: "ssh",
    args: sshArgs,
    options: {
      ...options,
      env: {
        ...process.env,
        ...(options?.env ?? {}),
      },
    },
  };
}

function buildOpenClawInvocation(args, options = {}, context = getOpenClawTransportContext()) {
  if (isOpenClawSshTransportContext(context)) {
    return buildSshInvocation(args, options, context);
  }

  return {
    command: "openclaw",
    args: buildOpenClawExecArgs(args, context),
    options: buildOpenClawExecOptions(
      {
        ...options,
      },
      context,
    ),
  };
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
