function normalizeNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function resolveRemoteDebuggingPort(options = {}) {
  const env = options?.env ?? process.env;
  const defaultPort = normalizeNonEmptyString(options?.defaultPort) || "9229";
  const isPackaged = Boolean(options?.isPackaged);
  const rawPort = normalizeNonEmptyString(env?.SABRINA_DEBUG_PORT);

  if (!rawPort) {
    return isPackaged ? null : defaultPort;
  }

  const lowered = rawPort.toLowerCase();
  if (lowered === "0" || lowered === "false" || lowered === "off" || lowered === "disabled") {
    return null;
  }

  const numericPort = Number(rawPort);
  if (Number.isInteger(numericPort) && numericPort > 0 && numericPort <= 65535) {
    return `${numericPort}`;
  }

  return isPackaged ? null : defaultPort;
}
