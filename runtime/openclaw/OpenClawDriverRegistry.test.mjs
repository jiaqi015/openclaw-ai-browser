import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { startSabrinaRelayDevServer } from "../../packages/sabrina-relay-dev/src/server.mjs";
import {
  ensureSabrinaRelayConnectCode,
} from "./SabrinaRemotePairingService.mjs";
import {
  getOpenClawDriverId,
  probeOpenClawDriverTransport,
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

test("relay-paired probe explains pending and claimed relay sessions without falling back local", async () => {
  const previous = getOpenClawTransportContext();
  const relay = await startSabrinaRelayDevServer({ port: 0 });
  const homeDir = await mkdtemp(path.join(os.tmpdir(), "sabrina-relay-probe-"));
  try {
    const created = await ensureSabrinaRelayConnectCode({
      homeDir,
      relayUrl: relay.url,
      publish: true,
    });
    const context = setOpenClawTransportContext({
      transport: "remote",
      driver: "relay-paired",
      relayUrl: relay.url,
      connectCode: created.session.code,
    });

    const pendingProbe = await probeOpenClawDriverTransport({ context });
    assert.equal(pendingProbe.ok, false);
    assert.match(pendingProbe.detail, /等待远端 OpenClaw 认领/);

    const claimResponse = await fetch(`${relay.url}/v1/pairings/claim`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        code: created.session.code,
        openclawDeviceId: "openclaw-1",
        openclawLabel: "Remote OpenClaw",
      }),
    });
    assert.equal(claimResponse.ok, true);

    const activeProbe = await probeOpenClawDriverTransport({ context });
    assert.equal(activeProbe.ok, false);
    assert.match(activeProbe.detail, /已被 Remote OpenClaw认领|已被 远端 OpenClaw认领|已被 Remote OpenClaw 认领/);
  } finally {
    await relay.close();
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
