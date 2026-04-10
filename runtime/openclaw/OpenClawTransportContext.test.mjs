import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOpenClawExecArgs,
  getOpenClawTransportContext,
  getOpenClawRemoteTargetRef,
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

test("transport context resolves relay remote target refs", () => {
  const previous = getOpenClawTransportContext();
  try {
    const next = setOpenClawTransportContext({
      transport: "remote",
      driver: "relay-paired",
      profile: "",
      stateDir: "",
      relayUrl: "https://relay.example.com",
      connectCode: "482913",
      label: "relay-remote",
    });

    assert.equal(getOpenClawRemoteTargetRef(next), "https://relay.example.com");
    assert.equal(resolveOpenClawStateDirFromContext(next), "~/.openclaw");
  } finally {
    setOpenClawTransportContext(previous);
  }
});

test("transport context defaults bare remote transport to relay-paired", () => {
  const previous = getOpenClawTransportContext();
  try {
    const next = setOpenClawTransportContext({
      transport: "remote",
      label: "relay-default",
    });

    assert.equal(next.driver, "relay-paired");
  } finally {
    setOpenClawTransportContext(previous);
  }
});
