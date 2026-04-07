import test from "node:test";
import assert from "node:assert/strict";
import { formatConnectionSummary } from "./bridge-client.mjs";

test("formatConnectionSummary includes connector schema and runtime insight lines", () => {
  const output = formatConnectionSummary(
    {
      summary: "Connected Sabrina",
      detail: "Remote control plane reachable.",
      transportLabel: "remote",
      commandHint: "openclaw sabrina doctor",
      remoteSessionContract: {
        contractVersion: "1",
        driver: "ssh-cli",
      },
    },
    {
      endpoint: "http://127.0.0.1:44718",
      browserCapabilitySchemaVersion: "1",
      remoteSessionContractVersion: "1",
      features: ["browser-capability-schema-v1", "turn-journal-v1"],
    },
    {
      skillCatalog: {
        ready: 6,
        total: 8,
        capabilitySourceCounts: {
          declared: 4,
          overlay: 1,
          heuristic: 1,
        },
      },
      turnJournal: {
        count: 12,
        latestStatus: "completed",
      },
      browserMemory: {
        count: 5,
        latestCapturedAt: "2026-04-07T11:00:00.000Z",
      },
    },
  );

  assert.match(output, /Connector: http:\/\/127\.0\.0\.1:44718/);
  assert.match(output, /Schema: capability v1 · remote v1/);
  assert.match(output, /Skills: 6\/8 ready · declared 4 · overlay 1 · heuristic 1/);
  assert.match(output, /Turn journal: 12 entries · latest completed/);
  assert.match(output, /Browser memory: 5 records · latest 2026-04-07T11:00:00.000Z/);
});
