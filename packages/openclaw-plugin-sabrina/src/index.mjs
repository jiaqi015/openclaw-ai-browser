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
    .option("--remote", "Reserve remote transport (currently returns attention state)")
    .option("--json", "Print raw JSON")
    .action(async (options) => {
      try {
        const result = await requestSabrinaConnector(
          api.pluginConfig ?? {},
          "/v1/openclaw/connect",
          {
            method: "POST",
            body: {
              target: options.remote ? "remote" : "local",
              profile: options.profile,
              stateDir: options.stateDir,
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
    .option("--json", "Print raw JSON")
    .action(async (options) => {
      try {
        const result = await requestSabrinaConnector(
          api.pluginConfig ?? {},
          `/v1/openclaw/doctor?target=${encodeURIComponent(options.target)}`,
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
