import {
  formatConnectionSummary,
  formatDoctorReport,
  getSabrinaConnectorHealth,
  requestSabrinaConnector,
} from "./bridge-client.mjs";

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function handleCliError(error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Sabrina: ${message}`);
  process.exitCode = 1;
}

function registerStatusCommand(rootCommand, api) {
  rootCommand
    .command("status")
    .description("Show Sabrina connector and OpenClaw connection status")
    .option("--json", "Print raw JSON")
    .action(async (options) => {
      try {
        const health = await getSabrinaConnectorHealth(api.pluginConfig ?? {});
        const status = await requestSabrinaConnector(
          api.pluginConfig ?? {},
          "/v1/openclaw/status",
        );

        if (options.json) {
          printJson({
            connector: health.payload?.connector ?? health.connector,
            state: status.payload?.state ?? null,
            connectionState: status.payload?.connectionState ?? null,
            runtimeInsights: status.payload?.runtimeInsights ?? null,
          });
          return;
        }

        console.log("Sabrina connector is reachable.");
        console.log(
          formatConnectionSummary(
            status.payload?.connectionState ?? null,
            health.payload?.connector ?? health.connector,
            status.payload?.runtimeInsights ?? null,
          ),
        );
      } catch (error) {
        handleCliError(error);
      }
    });
}

function registerConnectCommand(rootCommand, api) {
  rootCommand
    .command("connect")
    .description("Ask Sabrina to connect to the current OpenClaw control plane")
    .option("--profile <profile>", "Target a specific OpenClaw profile")
    .option("--state-dir <path>", "Target a specific OpenClaw state dir")
    .option("--remote", "Use a remote OpenClaw control plane")
    .option("--driver <driver>", "Remote driver (currently ssh-cli is implemented)")
    .option("--ssh-target <target>", "SSH target for the ssh-cli remote driver (for example root@example.com)")
    .option("--ssh-port <port>", "Optional SSH port for the ssh-cli driver")
    .option("--relay-url <url>", "Relay URL for the relay-paired remote driver")
    .option("--connect-code <code>", "Short-lived connect code for the relay-paired driver")
    .option("--label <label>", "Friendly label for the remote OpenClaw")
    .option("--agent <id>", "Prefer a specific remote agent")
    .option("--json", "Print raw JSON")
    .action(async (options) => {
      try {
        const requestedDriver =
          options.driver ||
          (options.remote || options.sshTarget
            ? "ssh-cli"
            : options.relayUrl || options.connectCode
              ? "relay-paired"
              : "local-cli");
        const target =
          options.remote || options.sshTarget || options.relayUrl || options.connectCode || requestedDriver !== "local-cli" ? "remote" : "local";
        const result = await requestSabrinaConnector(
          api.pluginConfig ?? {},
          "/v1/openclaw/connect",
          {
            method: "POST",
            body: {
              target,
              profile: options.profile,
              stateDir: options.stateDir,
              driver: target === "remote" ? requestedDriver : "local-cli",
              sshTarget: options.sshTarget,
              sshPort: options.sshPort ? Number(options.sshPort) : undefined,
              relayUrl: options.relayUrl,
              connectCode: options.connectCode,
              label: options.label,
              agentId: options.agent,
            },
          },
        );

        if (options.json) {
          printJson(result.payload);
          return;
        }

        console.log(formatConnectionSummary(result.payload?.connectionState ?? null));
      } catch (error) {
        handleCliError(error);
      }
    });
}

function registerDisconnectCommand(rootCommand, api) {
  rootCommand
    .command("disconnect")
    .description("Ask Sabrina to disconnect from the active OpenClaw control plane")
    .option("--json", "Print raw JSON")
    .action(async (options) => {
      try {
        const result = await requestSabrinaConnector(
          api.pluginConfig ?? {},
          "/v1/openclaw/disconnect",
          {
            method: "POST",
            body: {},
          },
        );

        if (options.json) {
          printJson(result.payload);
          return;
        }

        console.log(formatConnectionSummary(result.payload?.connectionState ?? null));
      } catch (error) {
        handleCliError(error);
      }
    });
}

function registerDoctorCommand(rootCommand, api) {
  rootCommand
    .command("doctor")
    .description("Run Sabrina connector diagnostics")
    .option("--target <target>", "local or remote", "local")
    .option("--driver <driver>", "Remote driver (currently ssh-cli is implemented)")
    .option("--ssh-target <target>", "SSH target for the ssh-cli remote driver")
    .option("--ssh-port <port>", "Optional SSH port for the ssh-cli driver")
    .option("--relay-url <url>", "Relay URL for the relay-paired remote driver")
    .option("--connect-code <code>", "Short-lived connect code for the relay-paired driver")
    .option("--label <label>", "Friendly label for the remote OpenClaw")
    .option("--agent <id>", "Prefer a specific remote agent")
    .option("--profile <profile>", "Target a specific OpenClaw profile")
    .option("--state-dir <path>", "Target a specific OpenClaw state dir")
    .option("--json", "Print raw JSON")
    .action(async (options) => {
      try {
        const params = new URLSearchParams();
        params.set("target", options.target);
        if (options.driver) params.set("driver", options.driver);
        if (options.sshTarget) params.set("sshTarget", options.sshTarget);
        if (options.sshPort) params.set("sshPort", `${options.sshPort}`);
        if (options.relayUrl) params.set("relayUrl", options.relayUrl);
        if (options.connectCode) params.set("connectCode", options.connectCode);
        if (options.label) params.set("label", options.label);
        if (options.agent) params.set("agentId", options.agent);
        if (options.profile) params.set("profile", options.profile);
        if (options.stateDir) params.set("stateDir", options.stateDir);
        if (!options.driver && (options.target === "remote" || options.sshTarget)) {
          params.set("driver", "ssh-cli");
        } else if (!options.driver && (options.relayUrl || options.connectCode)) {
          params.set("driver", "relay-paired");
        }
        const result = await requestSabrinaConnector(
          api.pluginConfig ?? {},
          `/v1/openclaw/doctor?${params.toString()}`,
        );

        if (options.json) {
          printJson(result.payload);
          return;
        }

        console.log(formatDoctorReport(result.payload?.report ?? null));
      } catch (error) {
        handleCliError(error);
      }
    });
}

function registerRelayCodeCommand(rootCommand, api) {
  rootCommand
    .command("relay-code")
    .description("Generate or reuse a Sabrina relay pairing code")
    .requiredOption("--relay-url <url>", "Relay URL for the relay-paired driver")
    .option("--ttl-seconds <seconds>", "Optional TTL for a newly created code")
    .option("--json", "Print raw JSON")
    .action(async (options) => {
      try {
        const ttlSeconds = options.ttlSeconds ? Number(options.ttlSeconds) : null;
        const result = await requestSabrinaConnector(
          api.pluginConfig ?? {},
          "/v1/openclaw/relay-pairing",
          {
            method: "POST",
            body: {
              relayUrl: options.relayUrl,
              ttlMs:
                Number.isFinite(ttlSeconds) && ttlSeconds > 0
                  ? Math.trunc(ttlSeconds * 1000)
                  : undefined,
            },
          },
        );

        if (options.json) {
          printJson(result.payload);
          return;
        }

        const session = result.payload?.state?.active ?? result.payload?.state?.session ?? null;
        if (!session) {
          console.log("Sabrina did not return an active relay pairing code.");
          return;
        }

        console.log(`Code: ${session.code}`);
        console.log(`Relay: ${session.relayUrl}`);
        console.log(`Device: ${session.browserDisplayName}`);
        console.log(`Expires: ${session.expiresAt}`);
      } catch (error) {
        handleCliError(error);
      }
    });
}

async function requestRelayJson(relayUrl, pathname, options = {}) {
  const normalizedRelayUrl = `${relayUrl ?? ""}`.trim().replace(/\/+$/, "");
  if (!normalizedRelayUrl) {
    throw new Error("Relay URL is required.");
  }

  const response = await fetch(`${normalizedRelayUrl}${pathname}`, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      typeof payload?.error === "string" && payload.error.trim()
        ? payload.error.trim()
        : `${response.status} ${response.statusText}`.trim();
    throw new Error(detail);
  }
  return payload;
}

function registerRelayClaimCommand(rootCommand) {
  rootCommand
    .command("relay-claim")
    .description("Claim a Sabrina relay pairing code from a remote OpenClaw machine")
    .requiredOption("--relay-url <url>", "Relay URL")
    .requiredOption("--connect-code <code>", "One-time Sabrina connect code")
    .option("--device-id <id>", "Optional OpenClaw device id")
    .option("--label <label>", "Optional OpenClaw display label")
    .option("--json", "Print raw JSON")
    .action(async (options) => {
      try {
        const payload = await requestRelayJson(options.relayUrl, "/v1/pairings/claim", {
          method: "POST",
          body: {
            code: options.connectCode,
            openclawDeviceId: options.deviceId,
            openclawLabel: options.label,
          },
        });

        if (options.json) {
          printJson(payload);
          return;
        }

        console.log(`Session: ${payload?.pairing?.sessionId ?? "unknown"}`);
        console.log(`Pairing: ${payload?.pairing?.pairingId ?? "unknown"}`);
        console.log(`Browser: ${payload?.pairing?.browserDisplayName ?? "unknown"}`);
        console.log(`Status: ${payload?.pairing?.status ?? "unknown"}`);
      } catch (error) {
        handleCliError(error);
      }
    });
}

const sabrinaPlugin = {
  id: "openclaw-plugin-sabrina",
  name: "Sabrina Browser Connector",
  description: "Connect OpenClaw to Sabrina for browser-native actions and browser memory sync.",
  register(api) {
    api.registerCli(
      ({ program }) => {
        const rootCommand = program
          .command("sabrina")
          .description("Connect OpenClaw to a local Sabrina desktop runtime");

        registerStatusCommand(rootCommand, api);
        registerConnectCommand(rootCommand, api);
        registerDisconnectCommand(rootCommand, api);
        registerDoctorCommand(rootCommand, api);
        registerRelayCodeCommand(rootCommand, api);
        registerRelayClaimCommand(rootCommand);
      },
      { commands: ["sabrina"] },
    );
  },
};

export default sabrinaPlugin;
