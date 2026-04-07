import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { startSabrinaRelayDevServer } from "../../packages/sabrina-relay-dev/src/server.mjs";
import {
  buildOpenClawSupportSnapshot,
  buildOpenClawRuntimeInsights,
  listOpenClawRelayEnvelopes,
  sendOpenClawRelayEnvelope,
} from "./OpenClawRuntimeService.mjs";
import {
  claimSabrinaRelayPairingCode,
  listSabrinaRelayEnvelopes,
  sendSabrinaRelayEnvelope,
} from "./relay/SabrinaRelayClient.mjs";
import { ensureSabrinaRelayConnectCode } from "./SabrinaRemotePairingService.mjs";

test("buildOpenClawRuntimeInsights projects capability, journal, and memory facts", () => {
  const insights = buildOpenClawRuntimeInsights({
    state: {
      connectionState: {
        remoteSessionContract: {
          contractVersion: "1",
          driver: "ssh-cli",
          transport: "remote",
          features: ["turn-journal-v1"],
        },
      },
      skillCatalog: {
        summary: {
          browserCapabilitySchemaVersion: "1",
          total: 8,
          eligible: 7,
          ready: 6,
          disabled: 1,
          blockedByAllowlist: 0,
          missingRequirements: 1,
          capabilitySourceCounts: {
            declared: 4,
            overlay: 1,
            heuristic: 1,
            metadata: 4,
          },
        },
      },
    },
    turnJournalStats: {
      path: "/tmp/turn-journal.json",
      count: 12,
      latestCreatedAt: "2026-04-07T12:00:00.000Z",
      latestThreadId: "thread-1",
      latestTurnId: "turn-1",
      latestStatus: "completed",
      statusCounts: { completed: 11, failed: 1 },
    },
    browserMemoryStats: {
      path: "/tmp/memory.json",
      count: 5,
      latestCapturedAt: "2026-04-07T11:00:00.000Z",
    },
  });

  assert.equal(insights.remoteSessionContract?.driver, "ssh-cli");
  assert.equal(insights.skillCatalog?.ready, 6);
  assert.equal(insights.skillCatalog?.capabilitySourceCounts.declared, 4);
  assert.equal(insights.turnJournal?.count, 12);
  assert.equal(insights.browserMemory?.count, 5);
});

test("buildOpenClawSupportSnapshot bundles runtime, journal, and memory views", () => {
  const snapshot = buildOpenClawSupportSnapshot({
    capturedAt: "2026-04-07T12:30:00.000Z",
    state: {
      selectedTarget: "remote",
      connectionState: {
        transport: "remote",
      },
    },
    runtimeInsights: {
      turnJournal: {
        count: 2,
      },
    },
    turnJournal: {
      ok: true,
      entries: [{ journalId: "journal-1", turnId: "turn-1" }],
      stats: { count: 2 },
    },
    browserMemory: {
      ok: true,
      query: "",
      records: [{ id: "memory-1", title: "Example" }],
      stats: { count: 1 },
    },
  });

  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.capturedAt, "2026-04-07T12:30:00.000Z");
  assert.equal(snapshot.connectionState?.transport, "remote");
  assert.equal(snapshot.turnJournal.entries.length, 1);
  assert.equal(snapshot.browserMemory.records.length, 1);
});

test("relay envelope roundtrip works through runtime wrappers and relay client helpers", async () => {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "sabrina-relay-runtime-"));
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
    const sessionId = claimed.pairing.sessionId;

    const browserSend = await sendOpenClawRelayEnvelope({
      relayUrl: relay.url,
      sessionId,
      from: "browser",
      to: "openclaw",
      type: "probe.ping",
      payload: {
        pingId: "ping-1",
      },
    });
    assert.equal(browserSend.envelope?.seq, 1);

    const openclawInbox = await listSabrinaRelayEnvelopes(relay.url, sessionId, {
      recipient: "openclaw",
    });
    assert.equal(openclawInbox.envelopes.length, 1);
    assert.equal(openclawInbox.envelopes[0].payload?.pingId, "ping-1");

    const openclawReply = await sendSabrinaRelayEnvelope(relay.url, sessionId, {
      from: "openclaw",
      to: "browser",
      type: "probe.pong",
      payload: {
        pingId: "ping-1",
        ok: true,
      },
    });
    assert.equal(openclawReply.envelope?.seq, 2);

    const browserInbox = await listOpenClawRelayEnvelopes({
      relayUrl: relay.url,
      sessionId,
      recipient: "browser",
      afterSeq: 1,
    });
    assert.equal(browserInbox.envelopes.length, 1);
    assert.equal(browserInbox.envelopes[0].type, "probe.pong");
    assert.equal(browserInbox.envelopes[0].payload?.ok, true);
  } finally {
    await relay.close();
  }
});
