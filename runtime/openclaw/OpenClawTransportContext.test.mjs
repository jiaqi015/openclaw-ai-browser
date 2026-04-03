import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOpenClawExecArgs,
  getOpenClawTransportContext,
  resolveOpenClawStateDirFromContext,
  setOpenClawTransportContext,
} from "./OpenClawTransportContext.mjs";

test("transport context prefixes profile and honors explicit state dir", () => {
  const previous = getOpenClawTransportContext();
  try {
    const next = setOpenClawTransportContext({
      transport: "local",
      profile: "demo",
      stateDir: "/tmp/openclaw-demo",
    });

    assert.deepEqual(buildOpenClawExecArgs(["status", "--json"], next), [
      "--profile",
      "demo",
      "status",
      "--json",
    ]);
    assert.equal(resolveOpenClawStateDirFromContext(next), "/tmp/openclaw-demo");
  } finally {
    setOpenClawTransportContext(previous);
  }
});

