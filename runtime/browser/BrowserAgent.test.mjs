import test from "node:test";
import assert from "node:assert/strict";
import { classifyAction } from "./ActionGate.mjs";
import { buildAgentPrompt, parseAgentAction } from "./BrowserAgentPromptService.mjs";

test("ActionGate: classifyAction correctly identifies risk levels", () => {
  // Green: scroll
  assert.equal(classifyAction({ type: "scroll" }, {}), "green");
  
  // Yellow: fill email
  assert.equal(classifyAction({ type: "fill" }, { type: "text", placeholder: "Email" }), "yellow");
  
  // Red: fill password
  assert.equal(classifyAction({ type: "fill" }, { type: "password" }), "red");
  
  // Red: click pay
  assert.equal(classifyAction({ type: "click" }, { text: "立即支付" }), "red");
});

test("BrowserAgentPromptService: build and parse", () => {
  const task = "帮我登录";
  const snapshot = {
    url: "https://example.com",
    title: "Login",
    scrollPosition: { y: 0, scrollHeight: 1000 },
    interactiveElements: [
      { index: 1, tag: "input", type: "text", text: "Username", value: "" }
    ],
    pageText: "Welcome to login page"
  };
  
  const prompt = buildAgentPrompt(task, snapshot);
  assert.ok(prompt.includes("帮我登录"));
  assert.ok(prompt.includes("[1] <input type=\"text\"> \"Username\""));
  
  const response = '{"action": "fill", "index": 1, "text": "testuser", "reason": "输入用户名"}';
  const action = parseAgentAction(response);
  assert.equal(action.action, "fill");
  assert.equal(action.index, 1);
  assert.equal(action.text, "testuser");
});

test("PlaywrightExecutor: exports executeAction", async () => {
  const { executeAction } = await import("./PlaywrightExecutor.mjs");
  assert.equal(typeof executeAction, "function");
});

test("PlaywrightObserver: exports observePage and waitForPageReady", async () => {
  const { observePage, waitForPageReady } = await import("./PlaywrightObserver.mjs");
  assert.equal(typeof observePage, "function");
  assert.equal(typeof waitForPageReady, "function");
});
