import test from "node:test";
import assert from "node:assert/strict";
import {
  getOpenClawDriverId,
  supportsOpenClawGatewayHttpManagement,
  supportsOpenClawRemoteCliExecution,
  supportsOpenClawSessionTrace,
} from "./drivers/OpenClawDriverRegistry.mjs";
import {
  getOpenClawTransportContext,
  setOpenClawTransportContext,
} from "./OpenClawTransportContext.mjs";

test("driver registry treats local transport as local-cli with local-only capabilities", () => {
  const previous = getOpenClawTransportContext();
  try {
    const context = setOpenClawTransportContext({
      transport: "local",
      driver: "local-cli",
    });

    assert.equal(getOpenClawDriverId(context), "local-cli");
    assert.equal(supportsOpenClawRemoteCliExecution(context), false);
    assert.equal(supportsOpenClawSessionTrace(context), true);
    assert.equal(supportsOpenClawGatewayHttpManagement(context), true);
  } finally {
    setOpenClawTransportContext(previous);
  }
});

test("driver registry keeps ssh-cli as remote CLI capable transport", () => {
  const previous = getOpenClawTransportContext();
  try {
    const context = setOpenClawTransportContext({
      transport: "remote",
      driver: "ssh-cli",
      sshTarget: "root@example.com",
    });

    assert.equal(getOpenClawDriverId(context), "ssh-cli");
    assert.equal(supportsOpenClawRemoteCliExecution(context), true);
    assert.equal(supportsOpenClawSessionTrace(context), false);
    assert.equal(supportsOpenClawGatewayHttpManagement(context), false);
  } finally {
    setOpenClawTransportContext(previous);
  }
});

test("driver registry keeps relay-paired remote without falling back to local capabilities", () => {
  const previous = getOpenClawTransportContext();
  try {
    const context = setOpenClawTransportContext({
      transport: "remote",
      driver: "relay-paired",
      relayUrl: "https://relay.example.com",
      connectCode: "482913",
    });

    assert.equal(getOpenClawDriverId(context), "relay-paired");
    assert.equal(supportsOpenClawRemoteCliExecution(context), false);
    assert.equal(supportsOpenClawSessionTrace(context), false);
    assert.equal(supportsOpenClawGatewayHttpManagement(context), false);
  } finally {
    setOpenClawTransportContext(previous);
  }
});
