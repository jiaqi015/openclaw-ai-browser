import test from "node:test";
import assert from "node:assert/strict";
import {
  getCurrentUiLocale,
  setCurrentUiLocale,
} from "../../shared/localization.mjs";
import {
  getOpenClawTransportContext,
  setOpenClawTransportContext,
} from "./OpenClawTransportContext.mjs";
import {
  buildLocalBindingRecord,
  buildRemoteBindingRecord,
} from "./OpenClawPresentationService.mjs";

test("buildRemoteBindingRecord localizes visible copy in English", () => {
  const previousLocale = getCurrentUiLocale();
  setCurrentUiLocale("en-US");

  try {
    const record = buildRemoteBindingRecord({
      agentId: "main",
      driver: "ssh-cli",
      sshTarget: "root@example.com",
      displayLabel: "JD Cloud",
      gatewayReachable: true,
    });

    assert.equal(
      record.note,
      "Connected to remote OpenClaw. The current remote driver is ssh-cli, and the browser reuses agent main.",
    );
    assert.equal(record.scopes[0]?.label, "Remote Control");
    assert.equal(
      record.scopes[0]?.description,
      "Reuses the OpenClaw control plane through a remote transport.",
    );
  } finally {
    setCurrentUiLocale(previousLocale);
  }
});

test("buildLocalBindingRecord localizes fallback labels in English", () => {
  const previousLocale = getCurrentUiLocale();
  const previousContext = getOpenClawTransportContext();
  setCurrentUiLocale("en-US");

  try {
    setOpenClawTransportContext({
      transport: "local",
      driver: "local-cli",
      profile: "",
      stateDir: "",
      label: "",
    });

    const record = buildLocalBindingRecord({
      device: null,
      deviceAuth: { tokens: {} },
      agentId: "browser-agent",
      agentRecord: null,
      gateway: { url: "http://127.0.0.1:8787" },
      gatewayReachable: false,
      gatewayHealthDetail: "gateway timeout",
      healthSummary: "",
      hostLabel: "jiaqi-mac",
    });

    assert.equal(record.deviceId, "No device identity found");
    assert.match(record.note, /browser agent browser-agent/);
    assert.match(record.note, /local gateway is not usable right now/);
    assert.equal(record.scopes[0]?.label, "No Device Scopes");
  } finally {
    setOpenClawTransportContext(previousContext);
    setCurrentUiLocale(previousLocale);
  }
});
