import test from "node:test";
import assert from "node:assert/strict";
import {
  getCurrentUiLocale,
  setCurrentUiLocale,
} from "../../shared/localization.mjs";
import {
  createConnectionState,
  createDefaultBindingSetupState,
  normalizeConnectionConfig,
} from "./OpenClawStateModel.mjs";

test("normalizeConnectionConfig derives remote driver defaults without losing remote metadata", () => {
  const config = normalizeConnectionConfig({
    transport: "remote",
    label: "jd-remote",
    sshTarget: "root@example.com",
    sshPort: 2222,
  }, "remote");

  assert.equal(config.transport, "remote");
  assert.equal(config.driver, "ssh-cli");
  assert.equal(config.label, "jd-remote");
  assert.equal(config.sshTarget, "root@example.com");
  assert.equal(config.sshPort, 2222);
});

test("normalizeConnectionConfig keeps relay remote metadata", () => {
  const config = normalizeConnectionConfig({
    transport: "remote",
    driver: "relay-paired",
    relayUrl: "https://relay.example.com",
    connectCode: " 482913 ",
    label: "relay-remote",
  }, "remote");

  assert.equal(config.driver, "relay-paired");
  assert.equal(config.relayUrl, "https://relay.example.com");
  assert.equal(config.connectCode, "482913");
  assert.equal(config.label, "relay-remote");
});

test("createConnectionState reports remote disconnected state as real remote setup instead of placeholder", () => {
  const state = createConnectionState({
    target: "remote",
    connectionConfig: {
      enabled: false,
      transport: "remote",
      driver: "ssh-cli",
      label: "jd-remote",
      sshTarget: "root@example.com",
    },
    bindingSetupState: createDefaultBindingSetupState("remote"),
  });

  assert.equal(state.status, "disconnected");
  assert.equal(state.summary, "尚未连接远程 OpenClaw");
  assert.match(state.detail, /远程 OpenClaw 控制面/);
  assert.match(state.commandHint, /--remote --driver ssh-cli --ssh-target/);
});

test("createConnectionState keeps remote attention wording generic when transport is unhealthy", () => {
  const state = createConnectionState({
    target: "remote",
    connectionConfig: {
      enabled: true,
      transport: "remote",
      driver: "ssh-cli",
      label: "jd-remote",
      sshTarget: "root@example.com",
    },
    bindingSetupState: {
      ...createDefaultBindingSetupState("remote"),
      status: "degraded",
    },
    lastError: "remote timeout",
  });

  assert.equal(state.status, "attention");
  assert.equal(state.summary, "连接需要处理");
  assert.equal(state.detail, "remote timeout");
  assert.match(state.doctorHint, /远程目标/);
  assert.doesNotMatch(state.detail, /暂未开放/);
});

test("createConnectionState gives relay-specific connection hint", () => {
  const state = createConnectionState({
    target: "remote",
    connectionConfig: {
      enabled: false,
      transport: "remote",
      driver: "relay-paired",
      relayUrl: null,
      connectCode: null,
      label: "relay-remote",
    },
    bindingSetupState: createDefaultBindingSetupState("remote"),
  });

  assert.match(state.commandHint, /--driver relay-paired --relay-url <url> --connect-code <code>/);
  assert.match(state.detail, /relay 地址和连接码/);
});

test("createConnectionState localizes remote summaries and doctor hints in English", () => {
  const previousLocale = getCurrentUiLocale();
  setCurrentUiLocale("en-US");

  try {
    const state = createConnectionState({
      target: "remote",
      connectionConfig: {
        enabled: false,
        transport: "remote",
        driver: "ssh-cli",
        label: "jd-remote",
        sshTarget: "root@example.com",
      },
      bindingSetupState: createDefaultBindingSetupState("remote"),
    });

    assert.equal(state.summary, "Not connected to remote OpenClaw");
    assert.match(state.detail, /Current target: jd-remote/);
    assert.equal(
      state.doctorHint,
      "If remote OpenClaw is already reachable, you can connect directly or run doctor first.",
    );
  } finally {
    setCurrentUiLocale(previousLocale);
  }
});

test("createDefaultBindingSetupState localizes remote defaults in English", () => {
  const previousLocale = getCurrentUiLocale();
  setCurrentUiLocale("en-US");

  try {
    const state = createDefaultBindingSetupState("remote");

    assert.equal(state.title, "Connect remote OpenClaw");
    assert.equal(state.description, "Reuse a remote OpenClaw control plane.");
    assert.equal(state.note, "Provide a remote control-plane target first.");
  } finally {
    setCurrentUiLocale(previousLocale);
  }
});
