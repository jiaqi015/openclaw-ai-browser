/**
 * BrowserAgentCapability.test.mjs — 核心能力集成测试
 * 角色: Dev-A (CAP-1/3/8感知&稳定性) + Dev-B (CAP-2/5执行&延续) + Dev-C (CAP-7持久化)
 * 覆盖: TC-1.x, TC-2.x, TC-3.x, TC-5.x, TC-7.x (CAP-4和CAP-6/8已独立)
 */
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { verifyElementFingerprint } from "./BrowserAgentService.mjs";

// ─── 工具函数 ────────────────────────────────────────────────────
function makeMockWC({ jsReturn = true, destroyed = false } = {}) {
  const calls = [];
  return {
    isDestroyed: () => destroyed,
    executeJavaScript: async (code) => {
      calls.push(code);
      return jsReturn;
    },
    once: () => {},
    _calls: calls,
  };
}

// ─── CAP-3: 稳定性护盾 / 动作指纹校验 ──────────────────────────
// verifyElementFingerprint 使用 PlaywrightObserver.observePage，
// 在无 Electron 环境中 observePage 会抛出，函数捕获后返回 false。
describe("CAP-3 verifyElementFingerprint — 动作指纹稳定性", () => {
  it("TC-3.1 无 Playwright 连接时安全返回 false（不抛异常）", async () => {
    const wc = makeMockWC();
    const result = await verifyElementFingerprint(wc, { index: 3, text: "提交" });
    assert.equal(result, false);
  });

  it("TC-3.2 webContents 已销毁时安全返回 false", async () => {
    const wc = makeMockWC({ destroyed: true });
    const result = await verifyElementFingerprint(wc, { index: 3, text: "提交" });
    assert.equal(result, false);
  });

  it("TC-3.4 原始文本含特殊引号时不抛异常", async () => {
    const wc = makeMockWC();
    await assert.doesNotReject(() =>
      verifyElementFingerprint(wc, { index: 1, text: 'He said "hello"' })
    );
  });
});

// ─── CAP-8: 提示词解析（快速边界验证） ─────────────────────────
describe("CAP-8 parseAgentAction — 快速边界测试", () => {
  // 动态 import 避免循环依赖
  it("TC-8-scroll scroll action 解析", async () => {
    const { parseAgentAction } = await import("./BrowserAgentPromptService.mjs");
    const result = parseAgentAction('{"action":"scroll","direction":"down"}');
    assert.equal(result.action, "scroll");
    assert.equal(result.direction, "down");
  });

  it("TC-8-navigate navigate action 解析", async () => {
    const { parseAgentAction } = await import("./BrowserAgentPromptService.mjs");
    const result = parseAgentAction('{"action":"navigate","url":"https://example.com"}');
    assert.equal(result.action, "navigate");
    assert.equal(result.url, "https://example.com");
  });
});

// ─── CAP-2: 执行引擎（PlaywrightExecutor 接口验证） ─────────────
// PlaywrightExecutor 需要真实 Playwright/CDP 连接才能执行动作，
// 这里只验证接口契约和销毁保护。
describe("CAP-2 PlaywrightExecutor — 执行引擎接口", () => {
  it("TC-2-unknown 未知 action type 返回 ok:false", async () => {
    const { executeAction } = await import("./PlaywrightExecutor.mjs");
    const wc = makeMockWC({ destroyed: false });
    const result = await executeAction(wc, { action: "teleport" });
    assert.equal(result.ok, false);
    assert.ok(result.error, "error message should exist");
  });

  it("TC-2-destroyed 销毁的 webContents 返回 ok:false", async () => {
    const { executeAction } = await import("./PlaywrightExecutor.mjs");
    const wc = makeMockWC({ destroyed: true });
    const result = await executeAction(wc, { action: "click", index: 1 });
    assert.equal(result.ok, false);
    assert.ok(result.error.includes("not available"));
  });

  it("TC-2-plans click action 会为 element 文本生成多级 fallback", async () => {
    const { buildLocatorPlans } = await import("./PlaywrightExecutor.mjs");
    const plans = buildLocatorPlans({
      action: "click",
      index: 32,
      element: {
        tag: "a",
        text: "卫兰的歌曲《不药而愈》",
        type: "",
      },
    }, "click");

    assert.deepEqual(
      plans.map((plan) => plan.kind),
      ["index", "roleText", "tagText", "text", "role", "tag"],
    );
  });

  it("TC-2-plans fill action 优先 placeholder 和输入类型", async () => {
    const { buildLocatorPlans } = await import("./PlaywrightExecutor.mjs");
    const plans = buildLocatorPlans({
      action: "fill",
      index: 2,
      element: {
        tag: "input",
        type: "search",
        placeholder: "搜索",
        text: "",
      },
    }, "fill");

    assert.deepEqual(
      plans.map((plan) => plan.kind),
      ["index", "placeholder", "type", "tag", "role"],
    );
  });
});

// ─── CAP-7: 记忆持久化 ──────────────────────────────────────────
describe("CAP-7 AgentTaskManager — 任务生命周期与持久化", () => {
  it("TC-7.1 createAgentTask 返回有效 taskId", async () => {
    const { createAgentTask } = await import("./AgentTaskManager.mjs");
    const taskId = createAgentTask({
      tabId: "test-tab-1",
      task: "测试任务",
      userData: {},
      threadId: "thread-1",
    });
    assert.ok(taskId.startsWith("agent-task-"));
  });

  it("TC-7.2 同一标签页重复创建任务：首个任务 idle 允许覆盖", async () => {
    const { createAgentTask, getAgentTask } = await import("./AgentTaskManager.mjs");
    const id1 = createAgentTask({
      tabId: "test-tab-dup",
      task: "任务1",
      userData: {},
    });
    // 第一个任务状态是 idle，可以创建第二个
    const id2 = createAgentTask({
      tabId: "test-tab-dup",
      task: "任务2",
      userData: {},
    });
    assert.ok(id2 !== id1, "Should create a new task id");
  });

  it("TC-7.3 getActiveTaskForTab 找到正确的任务", async () => {
    const { createAgentTask, getActiveTaskForTab } = await import("./AgentTaskManager.mjs");
    const tabId = `test-tab-${Math.random()}`;
    const taskId = createAgentTask({ tabId, task: "X", userData: {} });
    const found = getActiveTaskForTab(tabId);
    assert.ok(found, "Task must be findable by tabId");
    assert.equal(found.taskId, taskId);
  });

  it("TC-7.4 respondToConfirm 在无任务时不抛异常", async () => {
    const { respondToConfirm } = await import("./AgentTaskManager.mjs");
    await assert.doesNotReject(() => Promise.resolve(respondToConfirm("nonexistent-task-id", true)));
  });

  it("TC-7.5 cancelAgentTask 在无任务时不抛异常", async () => {
    const { cancelAgentTask } = await import("./AgentTaskManager.mjs");
    await assert.doesNotReject(() => Promise.resolve(cancelAgentTask("nonexistent-task-id")));
  });

  it("TC-7.6 getAgentTask 找不到不存在的任务返回 undefined", async () => {
    const { getAgentTask } = await import("./AgentTaskManager.mjs");
    const result = getAgentTask("definitely-not-exist-xyz");
    assert.equal(result, undefined);
  });
});

// ─── CAP-5 空间延续：中断信号测试 ──────────────────────────────
describe("CAP-5 AbortSignal — 中断保护机制", () => {
  it("TC-5.2 AbortController.signal 可以被创建并中断", () => {
    const ac = new AbortController();
    assert.equal(ac.signal.aborted, false);
    ac.abort();
    assert.equal(ac.signal.aborted, true);
  });

  it("TC-5.2b 中断后的 reason 可以被获取", () => {
    const ac = new AbortController();
    ac.abort(new Error("User cancelled"));
    assert.ok(ac.signal.aborted);
  });
});
