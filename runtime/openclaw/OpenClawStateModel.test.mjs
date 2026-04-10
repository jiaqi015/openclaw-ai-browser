import test from "node:test";
import assert from "node:assert/strict";
import {
  getCurrentUiLocale,
  setCurrentUiLocale,
} from "../../shared/localization.mjs";
import {
  createConnectionState,
  createDefaultBindingSetupState,
  createSavedConnectionRecord,
  normalizeConnectionConfig,
  normalizeSavedConnections,
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

test("normalizeConnectionConfig defaults remote targets to relay-paired when no legacy ssh target is present", () => {
  const config = normalizeConnectionConfig({
    transport: "remote",
    label: "relay-remote",
  }, "remote");

  assert.equal(config.transport, "remote");
  assert.equal(config.driver, "relay-paired");
  assert.equal(config.label, "relay-remote");
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
      "Make sure the relay URL, connect code, and remote worker are ready before connecting.",
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
    assert.equal(state.description, "Reuse a remote OpenClaw control plane with a pairing code.");
    assert.equal(state.note, "Enter the relay URL and generate a connect code first.");
  } finally {
    setCurrentUiLocale(previousLocale);
  }
});

test("createSavedConnectionRecord derives a stable remote preset from ssh config", () => {
  const saved = createSavedConnectionRecord({
    transport: "remote",
    driver: "ssh-cli",
    sshTarget: "root@example.com",
    sshPort: 2222,
    label: "京东云",
    agentId: "main",
    lastUsedAt: "2026-04-07T10:00:00.000Z",
  });

  assert.match(saved.id, /^openclaw-/);
  assert.equal(saved.name, "京东云");
  assert.equal(saved.transport, "remote");
  assert.equal(saved.driver, "ssh-cli");
  assert.equal(saved.sshTarget, "root@example.com");
  assert.equal(saved.sshPort, 2222);
  assert.equal(saved.agentId, "main");
  assert.equal(saved.status, "saved");
});

test("normalizeSavedConnections deduplicates remote presets and filters non-remote entries", () => {
  const first = createSavedConnectionRecord({
    id: "same-1",
    transport: "remote",
    driver: "ssh-cli",
    sshTarget: "root@example.com",
  });

  const normalized = normalizeSavedConnections([
    first,
    {
      ...first,
      name: "override-name",
      label: "override-name",
      lastUsedAt: "2026-04-07T11:00:00.000Z",
    },
    {
      id: "local-1",
      transport: "local",
      driver: "local-cli",
      label: "本机",
    },
  ]);

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].id, "same-1");
  assert.equal(normalized[0].name, "override-name");
  assert.equal(normalized[0].transport, "remote");
});
