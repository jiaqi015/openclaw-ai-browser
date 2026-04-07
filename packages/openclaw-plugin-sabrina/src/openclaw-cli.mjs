import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function parseCliJson(stdout) {
  const raw = `${stdout ?? ""}`;
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("OpenClaw CLI did not return JSON.");
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
      return normalized.startsWith("{") || normalized.startsWith("[");
    });

    if (jsonStartIndex >= 0) {
      return JSON.parse(lines.slice(jsonStartIndex).join("\n"));
    }

    throw new Error("OpenClaw CLI returned invalid JSON.");
  }
}

function buildOpenClawArgs(args = [], context = {}) {
  const commandArgs = [];
  if (`${context?.profile ?? ""}`.trim()) {
    commandArgs.push("--profile", `${context.profile}`.trim());
  }
  commandArgs.push(...(Array.isArray(args) ? args : []).filter(Boolean));
  return commandArgs;
}

function buildExecOptions(options = {}, context = {}) {
  const env = {
    ...process.env,
    ...(options?.env ?? {}),
  };
  if (`${context?.stateDir ?? ""}`.trim()) {
    env.OPENCLAW_STATE_DIR = `${context.stateDir}`.trim();
  }
  return {
    timeout: options?.timeout ?? 15_000,
    maxBuffer: options?.maxBuffer ?? 1024 * 1024 * 4,
    env,
  };
}

export async function execOpenClawCliJson(args = [], options = {}, context = {}) {
  const { stdout } = await execFileAsync(
    "openclaw",
    buildOpenClawArgs(args, context),
    buildExecOptions(options, context),
  );
  return parseCliJson(stdout);
}

export async function execOpenClawCliCommand(args = [], options = {}, context = {}) {
  return execFileAsync(
    "openclaw",
    buildOpenClawArgs(args, context),
    buildExecOptions(options, context),
  );
}
