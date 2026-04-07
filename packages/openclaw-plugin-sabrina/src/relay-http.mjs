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

export async function requestRelayJson(relayUrl, pathname, options = {}) {
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
  const payload = await parseRelayJson(response);
  if (!response.ok) {
    const detail =
      typeof payload?.error === "string" && payload.error.trim()
        ? payload.error.trim()
        : `${response.status} ${response.statusText}`.trim();
    throw new Error(detail);
  }
  return payload;
}

export async function claimRelayCode(relayUrl, payload = {}) {
  return requestRelayJson(relayUrl, "/v1/pairings/claim", {
    method: "POST",
    body: payload,
  });
}

export async function listRelayEnvelopes(relayUrl, sessionId, params = {}) {
  const normalizedSessionId = `${sessionId ?? ""}`.trim();
  if (!normalizedSessionId) {
    throw new Error("Relay session id is required.");
  }

  const query = new URLSearchParams();
  if (`${params?.recipient ?? ""}`.trim()) {
    query.set("recipient", `${params.recipient}`.trim());
  }
  if (Number.isFinite(Number(params?.afterSeq))) {
    query.set("afterSeq", `${Math.max(0, Math.trunc(Number(params.afterSeq)))}`);
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return requestRelayJson(
    relayUrl,
    `/v1/sessions/${encodeURIComponent(normalizedSessionId)}/envelopes${suffix}`,
  );
}

export async function sendRelayEnvelope(relayUrl, sessionId, payload = {}) {
  const normalizedSessionId = `${sessionId ?? ""}`.trim();
  if (!normalizedSessionId) {
    throw new Error("Relay session id is required.");
  }

  return requestRelayJson(
    relayUrl,
    `/v1/sessions/${encodeURIComponent(normalizedSessionId)}/envelopes`,
    {
      method: "POST",
      body: payload,
    },
  );
}
