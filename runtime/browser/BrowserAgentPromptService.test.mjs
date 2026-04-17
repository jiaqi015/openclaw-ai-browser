/**
 * BrowserAgentPromptService.test.mjs — CAP-8 提示词解析健壮性测试
 * 角色: Dev-A
 * 覆盖: TC-8.1 ~ TC-8.4 + 提示词构建验证
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseAgentAction, buildAgentPrompt } from "./BrowserAgentPromptService.mjs";

// ─── parseAgentAction ─────────────────────────────────────────────
describe("CAP-8 parseAgentAction — JSON 解析健壮性", () => {
  it("TC-8.1 标准 JSON 解析成功", () => {
    const result = parseAgentAction('{"action":"click","index":3,"reason":"Test"}');
    assert.equal(result.action, "click");
    assert.equal(result.index, 3);
  });

  it("TC-8.2 带 Markdown 代码块的响应", () => {
    const raw = '```json\n{"action":"fill","index":2,"text":"hello"}\n```';
    const result = parseAgentAction(raw);
    // 当前实现用 /\{[\s\S]*\}/ 匹配，能正确提取
    assert.equal(result.action, "fill");
    assert.equal(result.text, "hello");
  });

  it("TC-8.3 完全无效的自然语言输出", () => {
    const result = parseAgentAction("对不起，我无法完成此操作");
    assert.equal(result.action, "error");
    assert.ok(result.message.includes("无法解析"));
  });

  it("TC-8.4 截断 JSON 不抛异常", () => {
    const result = parseAgentAction('{"action":"click","index":');
    assert.equal(result.action, "error");
  });

  it("TC-8.5 空字符串不抛异常", () => {
    const result = parseAgentAction("");
    assert.equal(result.action, "error");
  });

  it("TC-8.6 null 输入不抛异常", () => {
    const result = parseAgentAction(null);
    assert.equal(result.action, "error");
  });

  it("TC-8.7 嵌套 JSON 取外层对象", () => {
    // LLM 有时会在 json 前写一段说明文字
    const raw = `I will click the button: {"action":"click","index":5}`;
    const result = parseAgentAction(raw);
    assert.equal(result.action, "click");
    assert.equal(result.index, 5);
  });

  it("TC-8.8 done action 解析", () => {
    const result = parseAgentAction('{"action":"done","summary":"任务已完成"}');
    assert.equal(result.action, "done");
    assert.equal(result.summary, "任务已完成");
  });

  it("TC-8.9 error action 解析", () => {
    const result = parseAgentAction('{"action":"error","message":"页面要求验证码"}');
    assert.equal(result.action, "error");
    assert.ok(result.message.includes("验证码"));
  });
});

// ─── buildAgentPrompt ─────────────────────────────────────────────
describe("CAP-8 buildAgentPrompt — 提示词构建", () => {
  const baseSnapshot = {
    url: "https://example.com/checkout",
    title: "结账页面",
    scrollPosition: { y: 0, scrollHeight: 1200 },
    interactiveElements: [
      { index: 1, tag: "input", text: "收货地址", type: "text", value: "", disabled: false },
      { index: 2, tag: "button", text: "提交订单", type: "", value: "", disabled: false },
    ],
    semanticGroups: { main: [1, 2] },
    pageText: "请填写您的收货信息...",
  };

  it("TC-8-prompt-contains-task 任务描述出现在 prompt 中", () => {
    const prompt = buildAgentPrompt("帮我完成结账", baseSnapshot, []);
    assert.ok(prompt.includes("帮我完成结账"));
  });

  it("TC-8-prompt-contains-url URL 出现在 prompt 中", () => {
    const prompt = buildAgentPrompt("test", baseSnapshot, []);
    assert.ok(prompt.includes("https://example.com/checkout"));
  });

  it("TC-8-prompt-contains-elements 可交互元素出现在 prompt 中", () => {
    const prompt = buildAgentPrompt("test", baseSnapshot, []);
    assert.ok(prompt.includes("[1]"));
    assert.ok(prompt.includes("收货地址"));
    assert.ok(prompt.includes("[2]"));
    assert.ok(prompt.includes("提交订单"));
  });

  it("TC-8-prompt-contains-journal 历史记录出现在 prompt 中", () => {
    const journal = [
      { step: 1, action: { action: "click", index: 1 }, result: { ok: true } }
    ];
    const prompt = buildAgentPrompt("test", baseSnapshot, journal);
    assert.ok(prompt.includes("步骤 1"));
  });

  it("TC-8-prompt-with-userData 用户数据出现在 prompt 中", () => {
    const userData = { 姓名: "张三", 手机: "13800138000" };
    const prompt = buildAgentPrompt("test", baseSnapshot, [], userData);
    assert.ok(prompt.includes("张三"));
    assert.ok(prompt.includes("13800138000"));
  });

  it("TC-8-prompt-format 包含 JSON 格式说明", () => {
    const prompt = buildAgentPrompt("test", baseSnapshot, []);
    assert.ok(prompt.includes("action"));
    assert.ok(prompt.includes("expectations"));
  });

  it("TC-8-prompt-no-userData 无用户数据有友善提示", () => {
    const prompt = buildAgentPrompt("test", baseSnapshot, [], null);
    assert.ok(prompt.includes("未提供"));
  });
});
