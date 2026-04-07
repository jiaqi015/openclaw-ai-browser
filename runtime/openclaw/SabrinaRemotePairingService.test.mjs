import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { startSabrinaRelayDevServer } from "../../packages/sabrina-relay-dev/src/server.mjs";
import { claimSabrinaRelayPairingCode } from "./relay/SabrinaRelayClient.mjs";
import {
  ensureSabrinaRelayConnectCode,
  getSabrinaRelayPairingState,
  markSabrinaRelayPairingActive,
} from "./SabrinaRemotePairingService.mjs";

test("ensureSabrinaRelayConnectCode creates and reuses a pending code for the same relay URL", async () => {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "sabrina-relay-code-"));

  const first = await ensureSabrinaRelayConnectCode({
    homeDir,
    relayUrl: "https://relay.example.com",
  });
  const second = await ensureSabrinaRelayConnectCode({
    homeDir,
    relayUrl: "https://relay.example.com",
  });

  assert.equal(first.session.code.length, 6);
  assert.equal(second.session.code, first.session.code);
  assert.equal(second.session.pairingId, first.session.pairingId);
  assert.equal(first.session.relayUrl, "https://relay.example.com");
  assert.equal(first.device.deviceId, second.device.deviceId);
});

test("getSabrinaRelayPairingState expires stale sessions and returns the active pending session", async () => {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "sabrina-relay-state-"));

  await ensureSabrinaRelayConnectCode({
    homeDir,
    relayUrl: "https://relay.example.com",
    ttlMs: 30_000,
  });
  await ensureSabrinaRelayConnectCode({
    homeDir,
    relayUrl: "https://relay-two.example.com",
  });

  const state = await getSabrinaRelayPairingState({
    homeDir,
    relayUrl: "https://relay-two.example.com",
  });

  assert.equal(state.active?.relayUrl, "https://relay-two.example.com");
  assert.equal(state.sessions.length, 1);
  assert.equal(state.sessions[0].status, "pending");
});

test("markSabrinaRelayPairingActive transitions a pending session to active", async () => {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "sabrina-relay-activate-"));
  const created = await ensureSabrinaRelayConnectCode({
    homeDir,
    relayUrl: "https://relay.example.com",
  });

  const activated = await markSabrinaRelayPairingActive({
    homeDir,
    pairingId: created.session.pairingId,
    openclawDeviceId: "remote-openclaw-1",
  });

  assert.equal(activated.session.status, "active");
  assert.equal(activated.session.pairingId, created.session.pairingId);
});

test("ensureSabrinaRelayConnectCode can publish a pairing to relay service", async () => {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "sabrina-relay-publish-"));
  const published = [];
  const created = await ensureSabrinaRelayConnectCode({
    homeDir,
    relayUrl: "https://relay.example.com",
    publish: true,
    publishSession: async (relayUrl, payload) => {
      published.push({ relayUrl, payload });
      return { ok: true };
    },
  });

  assert.equal(published.length, 1);
  assert.equal(published[0].relayUrl, "https://relay.example.com");
  assert.equal(published[0].payload.code, created.session.code);
  assert.equal(published[0].payload.status, "pending");
});

test("getSabrinaRelayPairingState syncs claimed relay state back into Sabrina storage", async () => {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "sabrina-relay-sync-"));
  const relay = await startSabrinaRelayDevServer({ port: 0 });

  try {
    const created = await ensureSabrinaRelayConnectCode({
      homeDir,
      relayUrl: relay.url,
      publish: true,
    });

    await claimSabrinaRelayPairingCode(relay.url, {
      code: created.session.code,
      openclawDeviceId: "remote-openclaw-1",
      openclawLabel: "Remote OpenClaw",
    });

    const state = await getSabrinaRelayPairingState({
      homeDir,
      relayUrl: relay.url,
      connectCode: created.session.code,
    });

    assert.equal(state.active?.status, "active");
    assert.equal(state.active?.openclawDeviceId, "remote-openclaw-1");
    assert.equal(state.active?.openclawLabel, "Remote OpenClaw");
    assert.equal(state.sessions[0]?.sessionId, `relay-session-${created.session.pairingId}`);
  } finally {
    await relay.close();
  }
});
