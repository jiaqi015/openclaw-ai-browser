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
          });
          return;
        }

        console.log("Sabrina connector is reachable.");
        console.log(formatConnectionSummary(status.payload?.connectionState ?? null));
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
      },
      { commands: ["sabrina"] },
    );
  },
};

export default sabrinaPlugin;
