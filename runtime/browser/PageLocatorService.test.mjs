/**
 * PageLocatorService.test.mjs — 定位层单测
 * 覆盖：语义匹配评分、别名解析、fallback 链
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { locateElement, resolveActionElement } from "./PageLocatorService.mjs";

// ─── 测试数据工厂 ──────────────────────────────────────────────────

function makeEl(overrides = {}) {
  return { index: 1, tag: "div", text: "", type: "", placeholder: "", value: "", failureCount: 0, ...overrides };
}

function makeSnap(elements) {
  return { interactiveElements: elements };
}

// ─── locateElement: 基础匹配 ──────────────────────────────────────

describe("locateElement — 文本匹配", () => {
  it("精确文本匹配返回该元素", () => {
    const snap = makeSnap([makeEl({ index: 3, tag: "button", text: "提交" })]);
    const el = locateElement(snap, { text: "提交" });
    assert.equal(el?.index, 3);
  });

  it("文本包含匹配得分低于精确匹配", () => {
    const snap = makeSnap([
      makeEl({ index: 1, tag: "button", text: "立即提交订单" }),
      makeEl({ index: 2, tag: "button", text: "提交" }),
    ]);
    const el = locateElement(snap, { text: "提交" });
    assert.equal(el?.index, 2); // 精确匹配优先
  });

  it("大小写不敏感匹配", () => {
    const snap = makeSnap([makeEl({ index: 5, tag: "button", text: "Submit" })]);
    const el = locateElement(snap, { text: "submit" });
    assert.equal(el?.index, 5);
  });

  it("无任何元素时返回 null", () => {
    assert.equal(locateElement(makeSnap([]), { text: "搜索" }), null);
  });

  it("得分低于 minScore 时返回 null", () => {
    const snap = makeSnap([makeEl({ index: 1, tag: "div", text: "" })]);
    assert.equal(locateElement(snap, { text: "不存在" }, 5), null);
  });
});

// ─── locateElement: role 匹配 ─────────────────────────────────────

describe("locateElement — role 匹配", () => {
  it("role=button 匹配 <button>", () => {
    const snap = makeSnap([makeEl({ index: 2, tag: "button", text: "OK" })]);
    const el = locateElement(snap, { role: "button", text: "OK" });
    assert.equal(el?.index, 2);
  });

  it("role=link 匹配 <a>", () => {
    const snap = makeSnap([makeEl({ index: 4, tag: "a", text: "首页" })]);
    const el = locateElement(snap, { role: "link", text: "首页" });
    assert.equal(el?.index, 4);
  });

  it("role=textbox 匹配 <input type=text>", () => {
    const snap = makeSnap([makeEl({ index: 6, tag: "input", type: "text", text: "" })]);
    const el = locateElement(snap, { role: "textbox" });
    assert.equal(el?.index, 6);
  });

  it("role=checkbox 匹配 <input type=checkbox>", () => {
    const snap = makeSnap([makeEl({ index: 7, tag: "input", type: "checkbox", text: "同意条款" })]);
    const el = locateElement(snap, { role: "checkbox" });
    assert.equal(el?.index, 7);
  });

  it("role=radio 匹配 <input type=radio>", () => {
    const snap = makeSnap([makeEl({ index: 8, tag: "input", type: "radio", text: "男" })]);
    const el = locateElement(snap, { role: "radio" });
    assert.equal(el?.index, 8);
  });
});

// ─── locateElement: searchbox 语义别名 ───────────────────────────

describe("locateElement — searchbox 语义别名", () => {
  it("role=searchbox 匹配 input[type=search]", () => {
    const snap = makeSnap([makeEl({ index: 10, tag: "input", type: "search", text: "" })]);
    const el = locateElement(snap, { role: "searchbox" });
    assert.equal(el?.index, 10);
  });

  it("role=searchbox 匹配 placeholder 含 search 的 input", () => {
    const snap = makeSnap([makeEl({ index: 11, tag: "input", type: "text", placeholder: "search here", text: "" })]);
    const el = locateElement(snap, { role: "searchbox" });
    assert.equal(el?.index, 11);
  });

  it("searchbox 别名得分高于普通 input", () => {
    const snap = makeSnap([
      makeEl({ index: 1, tag: "input", type: "text",   text: "" }),
      makeEl({ index: 2, tag: "input", type: "search", text: "" }),
    ]);
    const el = locateElement(snap, { role: "searchbox" });
    assert.equal(el?.index, 2);
  });
});

// ─── locateElement: hint 匹配 ─────────────────────────────────────

describe("locateElement — hint 模糊匹配", () => {
  it("hint 匹配 placeholder 文字", () => {
    const snap = makeSnap([makeEl({ index: 3, tag: "input", placeholder: "输入邮箱", text: "" })]);
    const el = locateElement(snap, { hint: "邮箱" });
    assert.equal(el?.index, 3);
  });

  it("hint 匹配 tag 名", () => {
    const snap = makeSnap([makeEl({ index: 4, tag: "select", text: "" })]);
    const el = locateElement(snap, { hint: "select" });
    assert.equal(el?.index, 4);
  });
});

// ─── locateElement: failureCount 惩罚 ────────────────────────────

describe("locateElement — failureCount 惩罚", () => {
  it("failureCount 高的元素被降权", () => {
    const snap = makeSnap([
      makeEl({ index: 1, tag: "button", text: "提交", failureCount: 3 }),
      makeEl({ index: 2, tag: "button", text: "提交" }),
    ]);
    const el = locateElement(snap, { text: "提交" });
    assert.equal(el?.index, 2); // failureCount=0 的优先
  });
});

// ─── resolveActionElement: fallback 链 ───────────────────────────

describe("resolveActionElement — target 语义优先", () => {
  it("有 action.target 时用语义定位", () => {
    const snap = makeSnap([makeEl({ index: 5, tag: "button", text: "搜索" })]);
    const action = { action: "click", index: 99, target: { text: "搜索" } };
    const el = resolveActionElement(snap, action);
    assert.equal(el?.index, 5);
  });

  it("无 target 时用 index 定位", () => {
    const snap = makeSnap([makeEl({ index: 3, tag: "button", text: "OK" })]);
    const action = { action: "click", index: 3 };
    const el = resolveActionElement(snap, action);
    assert.equal(el?.index, 3);
  });

  it("index 找不到时用 targetText 兜底", () => {
    const snap = makeSnap([makeEl({ index: 99, tag: "button", text: "提交" })]);
    const action = { action: "click", index: 1, targetText: "提交" };
    const el = resolveActionElement(snap, action);
    assert.equal(el?.index, 99);
  });

  it("三层都找不到时返回 null", () => {
    const snap = makeSnap([makeEl({ index: 1, tag: "button", text: "OK" })]);
    const action = { action: "click", index: 99 }; // index 不存在，无 target / targetText
    assert.equal(resolveActionElement(snap, action), null);
  });

  it("action 完全无定位信息时返回 null", () => {
    const snap = makeSnap([makeEl({ index: 1, tag: "button", text: "OK" })]);
    assert.equal(resolveActionElement(snap, { action: "click" }), null);
  });
});

describe("resolveActionElement — 空快照防护", () => {
  it("snapshot 为 null 时返回 null", () => {
    assert.equal(resolveActionElement(null, { action: "click", index: 1 }), null);
  });

  it("interactiveElements 为空时返回 null", () => {
    const snap = makeSnap([]);
    assert.equal(resolveActionElement(snap, { action: "click", index: 1 }), null);
  });
});
