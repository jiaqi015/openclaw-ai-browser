import {
  formatConnectionSummary,
  formatConnectionProbe,
  formatDoctorReport,
  getSabrinaConnectorHealth,
  requestSabrinaConnector,
} from "./bridge-client.mjs";
import {
  claimRelayCode,
  listRelayEnvelopes,
  sendRelayEnvelope,
} from "./relay-http.mjs";
import {
  processRelayWorkerTick,
  runRelayWorkerLoop,
} from "./relay-worker.mjs";
import {
  execOpenClawCliCommand,
  execOpenClawCliJson,
} from "./openclaw-cli.mjs";

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function handleCliError(error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Sabrina: ${message}`);
  process.exitCode = 1;
}

function parseRelayPayloadOption(value, text = "") {
  if (`${value ?? ""}`.trim()) {
    try {
      const parsed = JSON.parse(`${value}`.trim());
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("payload must be a JSON object");
      }
      return parsed;
    } catch (error) {
      throw new Error(
        `Invalid relay payload JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (`${text ?? ""}`.trim()) {
    return {
      text: `${text}`.trim(),
    };
  }

  return {};
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
    .option("--driver <driver>", "Remote driver (relay-paired by default; ssh-cli is legacy/internal)")
    .option("--ssh-target <target>", "Legacy SSH target for the ssh-cli fallback (for example root@example.com)")
    .option("--ssh-port <port>", "Optional SSH port for the legacy ssh-cli fallback")
    .option("--relay-url <url>", "Relay URL for the relay-paired remote driver")
    .option("--connect-code <code>", "Short-lived connect code for the relay-paired driver")
    .option("--label <label>", "Friendly label for the remote OpenClaw")
    .option("--agent <id>", "Prefer a specific remote agent")
    .option("--json", "Print raw JSON")
    .action(async (options) => {
      try {
        const requestedDriver =
          options.driver ||
          (options.relayUrl || options.connectCode
              ? "relay-paired"
              : options.sshTarget
                ? "ssh-cli"
                : options.remote
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
    .option("--driver <driver>", "Remote driver (relay-paired by default; ssh-cli is legacy/internal)")
    .option("--ssh-target <target>", "Legacy SSH target for the ssh-cli fallback")
    .option("--ssh-port <port>", "Optional SSH port for the legacy ssh-cli fallback")
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
        if (!options.driver && (options.relayUrl || options.connectCode)) {
          params.set("driver", "relay-paired");
        } else if (!options.driver && options.sshTarget) {
          params.set("driver", "ssh-cli");
        } else if (!options.driver && options.target === "remote") {
          params.set("driver", "relay-paired");
        }
        const result = await requestSabrinaConnector(
          api.pluginConfig ?? {},
          `/v1/openclaw/doctor?${params.toString()}`,
          {
            timeout: 20_000,
          },
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

function registerProbeCommand(rootCommand, api) {
  rootCommand
    .command("probe")
    .description("Run Sabrina quick connection checks before connecting")
    .option("--target <target>", "local or remote", "local")
    .option("--driver <driver>", "Remote driver (relay-paired by default; ssh-cli is legacy/internal)")
    .option("--ssh-target <target>", "Legacy SSH target for the ssh-cli fallback")
    .option("--ssh-port <port>", "Optional SSH port for the legacy ssh-cli fallback")
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
        if (!options.driver && (options.relayUrl || options.connectCode)) {
          params.set("driver", "relay-paired");
        } else if (!options.driver && options.sshTarget) {
          params.set("driver", "ssh-cli");
        } else if (!options.driver && options.target === "remote") {
          params.set("driver", "relay-paired");
        }

        const result = await requestSabrinaConnector(
          api.pluginConfig ?? {},
          `/v1/openclaw/probe?${params.toString()}`,
          {
            timeout: 20_000,
          },
        );

        if (options.json) {
          printJson(result.payload);
          return;
        }

        console.log(formatConnectionProbe(result.payload?.probe ?? null));
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
        const payload = await claimRelayCode(options.relayUrl, {
          code: options.connectCode,
          openclawDeviceId: options.deviceId,
          openclawLabel: options.label,
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

function registerRelayPollCommand(rootCommand) {
  rootCommand
    .command("relay-poll")
    .description("Poll relay envelopes for a claimed Sabrina relay session")
    .requiredOption("--relay-url <url>", "Relay URL")
    .requiredOption("--session-id <id>", "Claimed relay session id")
    .option("--recipient <party>", "browser, openclaw, or relay", "openclaw")
    .option("--after-seq <seq>", "Only return envelopes after this sequence number")
    .option("--json", "Print raw JSON")
    .action(async (options) => {
      try {
        const payload = await listRelayEnvelopes(options.relayUrl, options.sessionId, {
          recipient: options.recipient,
          afterSeq: options.afterSeq,
        });

        if (options.json) {
          printJson(payload);
          return;
        }

        const envelopes = Array.isArray(payload?.envelopes) ? payload.envelopes : [];
        if (envelopes.length === 0) {
          console.log("No relay envelopes available.");
          return;
        }

        for (const envelope of envelopes) {
          console.log(
            `#${envelope.seq} ${envelope.from} -> ${envelope.to} ${envelope.type} ${envelope.sentAt}`,
          );
          if (envelope.payload && typeof envelope.payload === "object") {
            console.log(JSON.stringify(envelope.payload, null, 2));
          }
        }
      } catch (error) {
        handleCliError(error);
      }
    });
}

function registerRelaySendCommand(rootCommand) {
  rootCommand
    .command("relay-send")
    .description("Send one relay envelope into a claimed Sabrina relay session")
    .requiredOption("--relay-url <url>", "Relay URL")
    .requiredOption("--session-id <id>", "Claimed relay session id")
    .option("--from <party>", "browser, openclaw, or relay", "openclaw")
    .option("--to <party>", "browser, openclaw, or relay", "browser")
    .option("--type <type>", "Envelope type", "message")
    .option("--payload <json>", "JSON object payload")
    .option("--text <text>", "Convenience text payload")
    .option("--json", "Print raw JSON")
    .action(async (options) => {
      try {
        const payload = await sendRelayEnvelope(options.relayUrl, options.sessionId, {
          from: options.from,
          to: options.to,
          type: options.type,
          payload: parseRelayPayloadOption(options.payload, options.text),
        });

        if (options.json) {
          printJson(payload);
          return;
        }

        console.log(
          `Sent #${payload?.envelope?.seq ?? "?"} ${payload?.envelope?.from ?? options.from} -> ${payload?.envelope?.to ?? options.to} ${payload?.envelope?.type ?? options.type}`,
        );
      } catch (error) {
        handleCliError(error);
      }
    });
}

function registerRelayWorkerCommand(rootCommand) {
  rootCommand
    .command("relay-worker")
    .description("Run the Sabrina relay worker loop for a claimed remote session")
    .requiredOption("--relay-url <url>", "Relay URL")
    .option("--session-id <id>", "Claimed relay session id")
    .option("--connect-code <code>", "Claim a Sabrina connect code before polling")
    .option("--device-id <id>", "Optional OpenClaw device id used during claim")
    .option("--label <label>", "Optional OpenClaw display label used during claim")
    .option("--profile <profile>", "Target a specific OpenClaw profile")
    .option("--state-dir <path>", "Target a specific OpenClaw state dir")
    .option("--once", "Process one worker tick and exit")
    .option("--after-seq <seq>", "Start polling after this sequence number")
    .option("--poll-ms <ms>", "Polling interval in milliseconds", "1000")
    .option("--idle-exit-seconds <seconds>", "Exit after being idle for this many seconds")
    .option("--json", "Print raw JSON")
    .action(async (options) => {
      try {
        let sessionId = `${options.sessionId ?? ""}`.trim();
        let claimPayload = null;
        if (!sessionId) {
          if (!`${options.connectCode ?? ""}`.trim()) {
            throw new Error("Relay worker requires either --session-id or --connect-code.");
          }
          claimPayload = await claimRelayCode(options.relayUrl, {
            code: options.connectCode,
            openclawDeviceId: options.deviceId,
            openclawLabel: options.label,
          });
          sessionId = `${claimPayload?.pairing?.sessionId ?? ""}`.trim();
        }
        if (!sessionId) {
          throw new Error("Relay worker could not resolve a claimed session id.");
        }

        const workerInput = {
          relayUrl: options.relayUrl,
          sessionId,
          afterSeq: options.afterSeq,
          pollIntervalMs: options.pollMs,
          idleExitMs: Number.isFinite(Number(options.idleExitSeconds))
            ? Math.max(0, Math.trunc(Number(options.idleExitSeconds) * 1000))
            : 0,
        };
        const cliContext = {
          profile: options.profile,
          stateDir: options.stateDir,
        };
        const payload = options.once
          ? await processRelayWorkerTick(workerInput, {
              execOpenClawCliJson: (args, workerOptions) =>
                execOpenClawCliJson(args, workerOptions, cliContext),
              execOpenClawCliCommand: (args, workerOptions) =>
                execOpenClawCliCommand(args, workerOptions, cliContext),
            })
          : await runRelayWorkerLoop(workerInput, {
              execOpenClawCliJson: (args, workerOptions) =>
                execOpenClawCliJson(args, workerOptions, cliContext),
              execOpenClawCliCommand: (args, workerOptions) =>
                execOpenClawCliCommand(args, workerOptions, cliContext),
            });
        const result = {
          ok: true,
          sessionId,
          claim: claimPayload?.pairing ?? null,
          worker: payload,
        };

        if (options.json) {
          printJson(result);
          return;
        }

        console.log(`Relay worker attached to ${sessionId}.`);
        if (claimPayload?.pairing?.openclawLabel) {
          console.log(`Label: ${claimPayload.pairing.openclawLabel}`);
        }
        if (options.once) {
          console.log(`Processed ${payload.processedCount ?? 0} request(s).`);
          return;
        }
        console.log(`Stopped: ${payload.stopped ?? "completed"}`);
        console.log(`Processed: ${payload.processedCount ?? 0}`);
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
        registerProbeCommand(rootCommand, api);
        registerDoctorCommand(rootCommand, api);
        registerRelayCodeCommand(rootCommand, api);
        registerRelayClaimCommand(rootCommand);
        registerRelayPollCommand(rootCommand);
        registerRelaySendCommand(rootCommand);
        registerRelayWorkerCommand(rootCommand);
      },
      { commands: ["sabrina"] },
    );
  },
};

export default sabrinaPlugin;
