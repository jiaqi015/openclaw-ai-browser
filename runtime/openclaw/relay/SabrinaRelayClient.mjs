function normalizeRelayUrl(relayUrl) {
  const normalized = `${relayUrl ?? ""}`.trim().replace(/\/+$/, "");
  if (!normalized) {
    throw new Error("缺少连接地址。");
  }
  return normalized;
}

async function parseRelayJson(response) {
  const text = await response.text();
  if (!text.trim()) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function requestRelay(relayUrl, pathname, options = {}) {
  const response = await fetch(`${normalizeRelayUrl(relayUrl)}${pathname}`, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await parseRelayJson(response);

  if (!response.ok) {
    const detail =
      typeof payload?.error === "string" && payload.error.trim()
        ? payload.error.trim()
        : `${response.status} ${response.statusText}`.trim();
    throw new Error(`Relay request failed: ${detail}`);
  }

  return payload;
}

export async function publishSabrinaRelayPairingSession(relayUrl, payload = {}) {
  return requestRelay(relayUrl, "/v1/pairings/register", {
    method: "POST",
    body: payload,
  });
}

export async function claimSabrinaRelayPairingCode(relayUrl, payload = {}) {
  return requestRelay(relayUrl, "/v1/pairings/claim", {
    method: "POST",
    body: payload,
  });
}

export async function getSabrinaRelayPairingRemoteState(relayUrl, pairingId) {
  const normalizedPairingId = `${pairingId ?? ""}`.trim();
  if (!normalizedPairingId) {
    throw new Error("缺少 pairingId。");
  }

  return requestRelay(
    relayUrl,
    `/v1/pairings/${encodeURIComponent(normalizedPairingId)}`,
  );
}

export async function getSabrinaRelayPairingRemoteStateByCode(relayUrl, code) {
  const normalizedCode = `${code ?? ""}`.trim().toUpperCase();
  if (!normalizedCode) {
    throw new Error("缺少连接码。");
  }

  return requestRelay(
    relayUrl,
    `/v1/pairings/by-code/${encodeURIComponent(normalizedCode)}`,
  );
}

export async function sendSabrinaRelayEnvelope(relayUrl, sessionId, payload = {}) {
  const normalizedSessionId = `${sessionId ?? ""}`.trim();
  if (!normalizedSessionId) {
    throw new Error("缺少 relay sessionId。");
  }

  return requestRelay(
    relayUrl,
    `/v1/sessions/${encodeURIComponent(normalizedSessionId)}/envelopes`,
    {
      method: "POST",
      body: payload,
    },
  );
}

export async function listSabrinaRelayEnvelopes(relayUrl, sessionId, params = {}) {
  const normalizedSessionId = `${sessionId ?? ""}`.trim();
  if (!normalizedSessionId) {
    throw new Error("缺少 relay sessionId。");
  }

  const query = new URLSearchParams();
  if (`${params?.recipient ?? ""}`.trim()) {
    query.set("recipient", `${params.recipient}`.trim());
  }
  if (Number.isFinite(Number(params?.afterSeq))) {
    query.set("afterSeq", `${Math.max(0, Math.trunc(Number(params.afterSeq)))}`);
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return requestRelay(
    relayUrl,
    `/v1/sessions/${encodeURIComponent(normalizedSessionId)}/envelopes${suffix}`,
  );
}
