import http from "node:http";
import { app } from "electron";
import {
  createSabrinaConnectorManifest,
  stripSabrinaConnectorSecret,
  SABRINA_CONNECTOR_DEFAULT_PORT,
} from "../../packages/sabrina-protocol/index.mjs";
import {
  connectOpenClaw,
  createOpenClawRelayConnectCode,
  disconnectOpenClaw,
  doctorOpenClaw,
  getOpenClawRelayPairingState,
  listOpenClawRelayEnvelopes,
  probeOpenClawConnection,
  getOpenClawSupportSnapshot,
  getOpenClawRuntimeInsights,
  getSerializedOpenClawState,
  sendOpenClawRelayEnvelope,
} from "../../runtime/openclaw/OpenClawRuntimeService.mjs";
import { recordRuntimeEvent } from "../../runtime/shared/SabrinaLoggerService.mjs";
import {
  configureConnectorServer,
  createConnectorBridgeRequestHandler,
  removeConnectorManifestFile,
  writeConnectorManifestFile,
} from "./SabrinaConnectorBridgeSupport.mjs";

let connectorServer = null;
let connectorManifest = null;
let connectorManifestPath = null;
let connectorRecordEvent = null;

function recordConnectorEvent(level, message, details = {}) {
  connectorRecordEvent?.(level, "openclaw", message, {
    source: "sabrina-connector-bridge",
    details,
  });
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Sabrina connector bridge did not expose a TCP address."));
        return;
      }
      resolve(address);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "127.0.0.1");
  });
}

async function listenWithFallback(server) {
  try {
    return await listen(server, SABRINA_CONNECTOR_DEFAULT_PORT);
  } catch (error) {
    if (error?.code !== "EADDRINUSE") {
      throw error;
    }
    return listen(server, 0);
  }
}

export async function startSabrinaConnectorBridge(options = {}) {
  if (connectorServer && connectorManifest) {
    return stripSabrinaConnectorSecret(connectorManifest);
  }

  connectorRecordEvent = typeof options.recordEvent === "function" ? options.recordEvent : null;
  const server = configureConnectorServer(
    http.createServer(
      createConnectorBridgeRequestHandler({
        getAppVersion: () => app.getVersion(),
        getConnectorManifest: () => connectorManifest,
        stripConnectorManifest: stripSabrinaConnectorSecret,
        recordEvent: (level, message, details) =>
          recordConnectorEvent(level, message, details),
        recordSecurityEvent: (type, details) => void recordRuntimeEvent(type, details),
        runtime: {
          connectOpenClaw,
          createOpenClawRelayConnectCode,
          disconnectOpenClaw,
          doctorOpenClaw,
          getOpenClawRelayPairingState,
          getOpenClawRuntimeInsights,
          getOpenClawSupportSnapshot,
          getSerializedOpenClawState,
          listOpenClawRelayEnvelopes,
          probeOpenClawConnection,
          sendOpenClawRelayEnvelope,
        },
      }),
    ),
  );
  const address = await listenWithFallback(server);
  connectorManifest = createSabrinaConnectorManifest({
    host: address.address,
    port: address.port,
  });
  connectorServer = server;
  connectorManifestPath = await writeConnectorManifestFile(connectorManifest);
  recordConnectorEvent("info", "Sabrina connector bridge ready", {
    endpoint: connectorManifest.endpoint,
  });
  return stripSabrinaConnectorSecret(connectorManifest);
}

export async function stopSabrinaConnectorBridge() {
  const server = connectorServer;
  connectorServer = null;

  if (!server) {
    return;
  }

  await new Promise((resolve) => {
    server.close(() => resolve());
  });
  await removeConnectorManifestFile(connectorManifestPath, connectorManifest?.token);
  recordConnectorEvent("info", "Sabrina connector bridge stopped");
  connectorManifest = null;
  connectorManifestPath = null;
}
