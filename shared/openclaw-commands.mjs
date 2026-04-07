function quoteIfNeeded(value) {
  const normalized = `${value ?? ""}`.trim();
  if (!normalized) {
    return "";
  }

  return /\s/.test(normalized) ? JSON.stringify(normalized) : normalized;
}

export function buildSabrinaRemoteConnectCommand(config = {}) {
  const driver = `${config?.driver ?? ""}`.trim() || "ssh-cli";
  if (driver === "relay-paired") {
    const relayUrl = `${config?.relayUrl ?? ""}`.trim() || "<url>";
    const connectCode = `${config?.connectCode ?? ""}`.trim() || "<code>";
    return [
      "openclaw sabrina connect --remote --driver relay-paired",
      `--relay-url ${quoteIfNeeded(relayUrl)}`,
      `--connect-code ${quoteIfNeeded(connectCode)}`,
    ].join(" ");
  }

  const sshTarget = `${config?.sshTarget ?? ""}`.trim() || "<user@host>";
  return [
    "openclaw sabrina connect --remote --driver ssh-cli",
    `--ssh-target ${quoteIfNeeded(sshTarget)}`,
  ].join(" ");
}

export function buildSabrinaRelayWorkerCommand(config = {}) {
  const relayUrl = `${config?.relayUrl ?? ""}`.trim();
  const connectCode = `${config?.connectCode ?? ""}`.trim();
  if (!relayUrl || !connectCode) {
    return "";
  }

  return [
    "openclaw sabrina relay-worker",
    `--relay-url ${quoteIfNeeded(relayUrl)}`,
    `--connect-code ${quoteIfNeeded(connectCode.toUpperCase())}`,
    `${config?.label ?? ""}`.trim()
      ? `--label ${quoteIfNeeded(config.label)}`
      : "",
    `${config?.agentId ?? ""}`.trim()
      ? `--agent ${quoteIfNeeded(config.agentId)}`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}
