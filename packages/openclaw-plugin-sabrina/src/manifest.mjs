import { loadSabrinaProtocol } from "./protocol-loader.mjs";

const { SABRINA_LOCAL_CAPABILITIES, SABRINA_PROTOCOL_VERSION } = await loadSabrinaProtocol();

export const sabrinaPluginManifest = {
  id: "openclaw-plugin-sabrina",
  name: "Sabrina Browser Connector",
  protocolVersion: SABRINA_PROTOCOL_VERSION,
  description: "Connect OpenClaw to Sabrina for browser-native actions and browser memory sync.",
  commands: ["connect", "status", "doctor", "disconnect"],
  capabilities: [...SABRINA_LOCAL_CAPABILITIES],
  transports: ["local", "remote"],
};
