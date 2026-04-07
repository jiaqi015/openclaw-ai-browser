import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { startSabrinaRelayDevServer } from "../../../packages/sabrina-relay-dev/src/server.mjs";
import { processRelayWorkerTick } from "../../../packages/openclaw-plugin-sabrina/src/relay-worker.mjs";
import { ensureSabrinaRelayConnectCode } from "../SabrinaRemotePairingService.mjs";
import { claimSabrinaRelayPairingCode } from "./SabrinaRelayClient.mjs";
import {
  invokeSabrinaRelayRpc,
  probeSabrinaRelayRpc,
} from "./SabrinaRelayRpcService.mjs";

async function processUntilHandled(params = {}) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const tick = await processRelayWorkerTick(params);
    if (tick.processedCount > 0) {
      return tick;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Relay worker did not receive an RPC request in time.");
}

test("invokeSabrinaRelayRpc roundtrips through relay worker", async () => {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "sabrina-relay-rpc-"));
  const relay = await startSabrinaRelayDevServer({ port: 0 });

  try {
    const created = await ensureSabrinaRelayConnectCode({
      homeDir,
      relayUrl: relay.url,
      publish: true,
    });
    const claimed = await claimSabrinaRelayPairingCode(relay.url, {
      code: created.session.code,
      openclawDeviceId: "remote-openclaw-1",
      openclawLabel: "Remote OpenClaw",
    });

    const responsePromise = invokeSabrinaRelayRpc({
      relayUrl: relay.url,
      connectCode: created.session.code,
      method: "rpc.ping",
      timeoutMs: 2_000,
      pollIntervalMs: 50,
    });

    await processUntilHandled({
      relayUrl: relay.url,
      sessionId: claimed.pairing.sessionId,
    });

    const response = await responsePromise;
    assert.equal(response.ok, true);
    assert.equal(response.result?.worker, "openclaw-plugin-sabrina");
    assert.match(response.result?.methods.join(","), /openclaw\.agent\.run/);
  } finally {
    await relay.close();
  }
});

test("probeSabrinaRelayRpc reports healthy worker when relay worker is active", async () => {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "sabrina-relay-rpc-probe-"));
  const relay = await startSabrinaRelayDevServer({ port: 0 });

  try {
    const created = await ensureSabrinaRelayConnectCode({
      homeDir,
      relayUrl: relay.url,
      publish: true,
    });
    const claimed = await claimSabrinaRelayPairingCode(relay.url, {
      code: created.session.code,
      openclawDeviceId: "remote-openclaw-2",
      openclawLabel: "Remote OpenClaw",
    });

    const probePromise = probeSabrinaRelayRpc({
      relayUrl: relay.url,
      connectCode: created.session.code,
      timeoutMs: 2_000,
      pollIntervalMs: 50,
    });

    await processUntilHandled({
      relayUrl: relay.url,
      sessionId: claimed.pairing.sessionId,
    });

    const probe = await probePromise;
    assert.equal(probe.ok, true);
    assert.match(probe.detail, /worker|命令通道/);
  } finally {
    await relay.close();
  }
});
