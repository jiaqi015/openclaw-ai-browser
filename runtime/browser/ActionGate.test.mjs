/**
 * ActionGate.test.mjs — CAP-4 安全闸门全量测试
 * 角色: Dev-C
 * 覆盖: TC-4.1 ~ TC-4.8
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyAction, getConfirmReason } from "./ActionGate.mjs";

// ─── RED 动作 ────────────────────────────────────────────────────
describe("CAP-4 ActionGate — RED actions", () => {
  it("TC-4.1 支付关键词触发 RED", () => {
    const action = { type: "click" };
    const element = { text: "立即支付", type: "" };
    assert.equal(classifyAction(action, element, {}), "red");
  });

  it("TC-4.2 购买关键词触发 RED", () => {
    const action = { type: "click" };
    const element = { text: "buy now", type: "" };
    assert.equal(classifyAction(action, element, {}), "red");
  });

  it("TC-4.2b 金额符号 ¥ 触发 RED", () => {
    const action = { type: "click" };
    const element = { text: "总计 ¥298", type: "" };
    assert.equal(classifyAction(action, element, {}), "red");
  });

  it("TC-4.2c 金额单词 price 触发 RED", () => {
    const action = { type: "click" };
    const element = { text: "view price", type: "" };
    assert.equal(classifyAction(action, element, {}), "red");
  });

  it("TC-4.3 密码框 fill 触发 RED", () => {
    const action = { type: "fill" };
    const element = { text: "", type: "password" };
    assert.equal(classifyAction(action, element, {}), "red");
  });

  it("TC-4.3b 删除关键词触发 RED", () => {
    const action = { type: "click" };
    const element = { text: "删除账号", type: "" };
    assert.equal(classifyAction(action, element, {}), "red");
  });
});

// ─── YELLOW 动作 ──────────────────────────────────────────────────
describe("CAP-4 ActionGate — YELLOW actions", () => {
  it("TC-4.4 提交按钮触发 YELLOW", () => {
    const action = { type: "click" };
    const element = { text: "提交表单", type: "" };
    assert.equal(classifyAction(action, element, {}), "yellow");
  });

  it("TC-4.5 登录按钮触发 YELLOW", () => {
    const action = { type: "click" };
    const element = { text: "登录", type: "" };
    assert.equal(classifyAction(action, element, {}), "yellow");
  });

  it("TC-4.5b next 按钮触发 YELLOW", () => {
    const action = { type: "click" };
    const element = { text: "Next Step", type: "" };
    assert.equal(classifyAction(action, element, {}), "yellow");
  });

  it("TC-4.6 跨域导航触发 YELLOW", () => {
    const action = { type: "navigate", url: "https://evil.com/page" };
    const element = null;
    const ctx = { currentOrigin: "https://example.com" };
    assert.equal(classifyAction(action, element, ctx), "yellow");
  });

  it("TC-4.6b 同域导航为 GREEN", () => {
    const action = { type: "navigate", url: "https://example.com/other" };
    const element = null;
    const ctx = { currentOrigin: "https://example.com" };
    assert.equal(classifyAction(action, element, ctx), "green");
  });

  it("TC-4.6c 无效 URL 导航触发 YELLOW", () => {
    const action = { type: "navigate", url: "not-a-url" };
    const element = null;
    const ctx = { currentOrigin: "https://example.com" };
    assert.equal(classifyAction(action, element, ctx), "yellow");
  });

  it("TC-4-fill-email 邮箱字段触发 YELLOW", () => {
    const action = { type: "fill" };
    const element = { text: "", type: "email", placeholder: "your@email.com" };
    assert.equal(classifyAction(action, element, {}), "yellow");
  });

  it("TC-4-fill-phone 手机字段触发 YELLOW", () => {
    const action = { type: "fill" };
    const element = { text: "手机号码", type: "tel", placeholder: "" };
    assert.equal(classifyAction(action, element, {}), "yellow");
  });
});

// ─── GREEN 动作 ───────────────────────────────────────────────────
describe("CAP-4 ActionGate — GREEN actions", () => {
  it("TC-4.7 普通阅读类点击为 GREEN", () => {
    const action = { type: "click" };
    const element = { text: "了解更多", type: "" };
    assert.equal(classifyAction(action, element, {}), "green");
  });

  it("TC-4.8 scroll 操作为 GREEN", () => {
    const action = { type: "scroll", direction: "down" };
    assert.equal(classifyAction(action, null, {}), "green");
  });

  it("TC-4-green-same-domain-nav 同域导航为 GREEN", () => {
    const action = { type: "navigate", url: "https://example.com/faq" };
    const ctx = { currentOrigin: "https://example.com" };
    assert.equal(classifyAction(action, null, ctx), "green");
  });

  it("TC-4-fill-no-sensitive 无敏感字段 fill 为 GREEN", () => {
    const action = { type: "fill" };
    const element = { text: "备注", type: "text", placeholder: "请输入备注" };
    assert.equal(classifyAction(action, element, {}), "green");
  });
});

// ─── getConfirmReason ─────────────────────────────────────────────
describe("CAP-4 ActionGate — getConfirmReason", () => {
  it("密码框给出密码专属提示", () => {
    const action = { type: "fill" };
    const element = { type: "password", text: "" };
    const reason = getConfirmReason(action, element);
    assert.ok(reason.includes("密码"));
  });

  it("点击操作包含元素文本", () => {
    const action = { type: "click" };
    const element = { type: "", text: "提交订单" };
    const reason = getConfirmReason(action, element);
    assert.ok(reason.includes("提交订单"));
  });

  it("导航操作包含目标 URL", () => {
    const action = { type: "navigate", url: "https://evil.com" };
    const element = null;
    const reason = getConfirmReason(action, element);
    assert.ok(reason.includes("https://evil.com"));
  });
});
