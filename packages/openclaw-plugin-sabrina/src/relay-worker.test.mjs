import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { startSabrinaRelayDevServer } from "../../sabrina-relay-dev/src/server.mjs";
import { ensureSabrinaRelayConnectCode } from "../../../runtime/openclaw/SabrinaRemotePairingService.mjs";
import {
  claimRelayCode,
  listRelayEnvelopes,
  sendRelayEnvelope,
} from "./relay-http.mjs";
import {
  handleRelayRpcRequest,
  processRelayWorkerTick,
} from "./relay-worker.mjs";

test("handleRelayRpcRequest returns worker capabilities for ping", async () => {
  const result = await handleRelayRpcRequest({
    method: "rpc.ping",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.methods, [
    "rpc.ping",
    "openclaw.snapshot",
    "openclaw.skills.status",
    "openclaw.agent.run",
    "openclaw.model.set",
  ]);
});

test("processRelayWorkerTick consumes rpc requests and emits rpc responses", async () => {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "sabrina-relay-worker-"));
  const relay = await startSabrinaRelayDevServer({ port: 0 });

  try {
    const created = await ensureSabrinaRelayConnectCode({
      homeDir,
      relayUrl: relay.url,
      publish: true,
    });
    const claimed = await claimRelayCode(relay.url, {
      code: created.session.code,
      openclawDeviceId: "remote-openclaw-1",
      openclawLabel: "Remote OpenClaw",
    });
    const sessionId = claimed.pairing.sessionId;

    await sendRelayEnvelope(relay.url, sessionId, {
      from: "browser",
      to: "openclaw",
      type: "rpc.request",
      payload: {
        kind: "rpc.request",
        requestId: "req-1",
        method: "openclaw.snapshot",
        params: {},
      },
    });

    const tick = await processRelayWorkerTick(
      {
        relayUrl: relay.url,
        sessionId,
      },
      {
        execOpenClawCliJson: async (args) => {
          if (args[0] === "gateway" && args[1] === "status") {
            return {
              rpc: { ok: true },
              gateway: { bindHost: "127.0.0.1", port: 18789 },
              service: { runtime: { status: "running" }, configAudit: { issues: [] } },
            };
          }
          if (args[0] === "gateway" && args[1] === "health") {
            return { ok: true };
          }
          if (args[0] === "models" && args[1] === "status") {
            return {
              defaultModel: "provider/model-a",
              resolvedDefault: "provider/model-a",
              models: [
                {
                  id: "provider/model-a",
                  label: "Model A",
                  desc: "Primary",
                  available: true,
                },
              ],
            };
          }
          throw new Error(`Unexpected CLI call: ${args.join(" ")}`);
        },
      },
    );
    assert.equal(tick.processedCount, 1);

    const browserInbox = await listRelayEnvelopes(relay.url, sessionId, {
      recipient: "browser",
    });
    assert.equal(browserInbox.envelopes.length, 1);
    assert.equal(browserInbox.envelopes[0].type, "rpc.response");
    assert.equal(browserInbox.envelopes[0].payload?.requestId, "req-1");
    assert.equal(browserInbox.envelopes[0].payload?.ok, true);
    assert.equal(
      browserInbox.envelopes[0].payload?.result?.models?.resolvedDefault,
      "provider/model-a",
    );
  } finally {
    await relay.close();
  }
});
