import test from "node:test";
import assert from "node:assert/strict";
import { startSabrinaRelayDevServer } from "./server.mjs";

test("relay dev server registers, claims, and retrieves pairings", async () => {
  const relay = await startSabrinaRelayDevServer({ port: 0 });
  try {
    const registerResponse = await fetch(`${relay.url}/v1/pairings/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        pairingId: "pair-1",
        code: "BMX367",
        relayUrl: relay.url,
        browserDeviceId: "browser-1",
        browserDisplayName: "Sabrina Browser",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    });
    const registered = await registerResponse.json();
    assert.equal(registered.pairing.status, "pending");

    const claimResponse = await fetch(`${relay.url}/v1/pairings/claim`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        code: "BMX367",
        openclawDeviceId: "openclaw-1",
        openclawLabel: "Remote OpenClaw",
      }),
    });
    const claimed = await claimResponse.json();
    assert.equal(claimed.pairing.status, "active");
    assert.equal(claimed.pairing.openclawDeviceId, "openclaw-1");

    const byCodeResponse = await fetch(`${relay.url}/v1/pairings/by-code/BMX367`);
    const byCode = await byCodeResponse.json();
    assert.equal(byCode.pairing.status, "active");
    assert.equal(byCode.pairing.openclawLabel, "Remote OpenClaw");

    const stateResponse = await fetch(`${relay.url}/v1/pairings/pair-1`);
    const state = await stateResponse.json();
    assert.equal(state.pairing.status, "active");
    assert.equal(state.pairing.code, "BMX367");
  } finally {
    await relay.close();
  }
});
