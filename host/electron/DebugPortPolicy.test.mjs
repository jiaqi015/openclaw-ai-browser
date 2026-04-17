import test from "node:test";
import assert from "node:assert/strict";
import { resolveRemoteDebuggingPort } from "./DebugPortPolicy.mjs";

test("resolveRemoteDebuggingPort defaults to 9229 in dev", () => {
  assert.equal(resolveRemoteDebuggingPort({ isPackaged: false, env: {} }), "9229");
});

test("resolveRemoteDebuggingPort disables CDP by default in packaged builds", () => {
  assert.equal(resolveRemoteDebuggingPort({ isPackaged: true, env: {} }), null);
});

test("resolveRemoteDebuggingPort honors explicit SABRINA_DEBUG_PORT in packaged builds", () => {
  assert.equal(
    resolveRemoteDebuggingPort({
      isPackaged: true,
      env: { SABRINA_DEBUG_PORT: "9333" },
    }),
    "9333",
  );
});

test("resolveRemoteDebuggingPort allows explicit disable flag", () => {
  assert.equal(
    resolveRemoteDebuggingPort({
      isPackaged: false,
      env: { SABRINA_DEBUG_PORT: "off" },
    }),
    null,
  );
});

test("resolveRemoteDebuggingPort falls back safely on invalid dev values", () => {
  assert.equal(
    resolveRemoteDebuggingPort({
      isPackaged: false,
      env: { SABRINA_DEBUG_PORT: "not-a-port" },
    }),
    "9229",
  );
});
