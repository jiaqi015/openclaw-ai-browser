import {
  buildOpenClawExecArgs,
  buildOpenClawExecOptions,
} from "../OpenClawTransportContext.mjs";

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

export function buildSshArgsForCommand(command, context) {
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

  sshArgs.push(context.sshTarget, command);
  return sshArgs;
}

function formatProbeError(error) {
  const stderr =
    typeof error?.stderr === "string" && error.stderr.trim()
      ? error.stderr.trim()
      : "";
  if (stderr) {
    return stderr;
  }
  return error instanceof Error ? error.message : String(error);
}

export const sshCliDriver = Object.freeze({
  id: "ssh-cli",
  capabilities: Object.freeze({
    remote: true,
    remoteCliExecution: true,
    sessionTrace: false,
    gatewayHttpManagement: false,
  }),
  buildInvocation(args = [], options = {}, context) {
    return {
      command: "ssh",
      args: buildSshArgsForCommand(buildSshRemoteCommand(args, context), context),
      options: {
        ...options,
        env: {
          ...process.env,
          ...(options?.env ?? {}),
        },
      },
    };
  },
  async probeTransport(options = {}, context) {
    try {
      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execFileAsync = promisify(execFile);
      const { stdout } = await execFileAsync(
        "ssh",
        buildSshArgsForCommand("printf __SABRINA_REMOTE_OK__", context),
        {
          timeout: options?.timeout ?? 5000,
          maxBuffer: options?.maxBuffer ?? 1024 * 8,
          env: {
            ...process.env,
          },
        },
      );
      return {
        ok: stdout.includes("__SABRINA_REMOTE_OK__"),
        detail: stdout.includes("__SABRINA_REMOTE_OK__")
          ? ""
          : "远程控制面没有返回探针响应。",
      };
    } catch (error) {
      return {
        ok: false,
        detail: formatProbeError(error),
      };
    }
  },
});
