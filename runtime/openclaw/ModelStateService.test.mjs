import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLocalModelState,
  readLocalModelState,
} from "./ModelStateService.mjs";

test("buildLocalModelState falls back to status payload when model list is unavailable", () => {
  const state = buildLocalModelState({
    agentId: "saburina-browser",
    agentRecords: [
      {
        id: "saburina-browser",
        model: "provider/active-model",
      },
    ],
    listPayload: null,
    statusPayload: {
      defaultModel: "provider/active-model",
      resolvedDefault: "provider/active-model",
      aliases: {
        active: "provider/active-model",
        backup: "provider/backup-model",
      },
      allowed: ["provider/active-model", "provider/backup-model"],
    },
  });

  assert.equal(state.agentId, "saburina-browser");
  assert.equal(state.desiredModel, "provider/active-model");
  assert.equal(state.appliedModel, "provider/active-model");
  assert.deepEqual(
    state.models.map((model) => ({
      id: model.id,
      label: model.label,
      available: model.available,
    })),
    [
      {
        id: "provider/active-model",
        label: "active",
        available: true,
      },
      {
        id: "provider/backup-model",
        label: "backup",
        available: true,
      },
    ],
  );
});

test("readLocalModelState degrades gracefully when models list enrichment times out", async () => {
  const calls = [];
  const state = await readLocalModelState("saburina-browser", {
    execJson: async (args) => {
      calls.push(args.join(" "));
      if (args[0] === "agents") {
        return [
          {
            id: "saburina-browser",
            model: "provider/active-model",
          },
        ];
      }
      if (args[0] === "models" && args.includes("status")) {
        return {
          defaultModel: "provider/active-model",
          resolvedDefault: "provider/active-model",
          aliases: {
            active: "provider/active-model",
            backup: "provider/backup-model",
          },
          allowed: ["provider/active-model", "provider/backup-model"],
        };
      }
      if (args[0] === "models" && args.includes("list")) {
        throw new Error("Command failed: openclaw models --agent saburina-browser list --all --json");
      }
      throw new Error(`unexpected args: ${args.join(" ")}`);
    },
  });

  assert.deepEqual(calls, [
    "agents list --json",
    "models --agent saburina-browser list --all --json",
    "models --agent saburina-browser status --json",
  ]);
  assert.equal(state.appliedModel, "provider/active-model");
  assert.equal(state.models.length, 2);
  assert.equal(state.models[0].label, "active");
});
