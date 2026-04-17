/**
 * PageNarratorService.test.mjs — 叙述层单测
 * 覆盖：场景分类、元素评分、快照 diff、格式化输出
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { narratePage, formatNarration } from "./PageNarratorService.mjs";

// ─── 测试数据工厂 ──────────────────────────────────────────────────

function makeSnapshot(overrides = {}) {
  return {
    url: "https://example.com",
    title: "Example",
    pageText: "Some page text",
    scrollPosition: { y: 0, scrollHeight: 1000 },
    hasMoreContent: false,
    interactiveElements: [],
    axNodes: [],
    ...overrides,
  };
}

function makeEl(overrides = {}) {
  return { index: 1, tag: "div", text: "", type: "", value: "", disabled: false, failureCount: 0, ...overrides };
}

// ─── narratePage: 场景分类 ─────────────────────────────────────────

describe("narratePage — 场景分类 classifyScene", () => {
  it("URL 含 login → scene_type = login", () => {
    const snap = makeSnapshot({ url: "https://example.com/login" });
    assert.equal(narratePage(snap).scene_type, "login");
  });

  it("URL 含 signin → scene_type = login", () => {
    const snap = makeSnapshot({ url: "https://app.com/signin" });
    assert.equal(narratePage(snap).scene_type, "login");
  });

  it("URL 含 register → scene_type = register", () => {
    const snap = makeSnapshot({ url: "https://example.com/register" });
    assert.equal(narratePage(snap).scene_type, "register");
  });

  it("URL 含 search → scene_type = search_results", () => {
    const snap = makeSnapshot({ url: "https://example.com/search?q=foo" });
    assert.equal(narratePage(snap).scene_type, "search_results");
  });

  it("URL 含 cart → scene_type = checkout", () => {
    const snap = makeSnapshot({ url: "https://shop.com/cart" });
    assert.equal(narratePage(snap).scene_type, "checkout");
  });

  it("URL 含 product → scene_type = product", () => {
    const snap = makeSnapshot({ url: "https://shop.com/product/123" });
    assert.equal(narratePage(snap).scene_type, "product");
  });

  it("有 password input → login_form（无 URL 关键词时降级）", () => {
    const snap = makeSnapshot({
      interactiveElements: [makeEl({ tag: "input", type: "password" })],
    });
    assert.equal(narratePage(snap).scene_type, "login_form");
  });

  it("有 search input → search_home（无 URL 关键词时降级）", () => {
    const snap = makeSnapshot({
      interactiveElements: [makeEl({ tag: "input", type: "search" })],
    });
    assert.equal(narratePage(snap).scene_type, "search_home");
  });

  it("≥3 个 input/textarea/select → form", () => {
    const snap = makeSnapshot({
      interactiveElements: [
        makeEl({ tag: "input", type: "text" }),
        makeEl({ index: 2, tag: "input", type: "email" }),
        makeEl({ index: 3, tag: "select" }),
      ],
    });
    assert.equal(narratePage(snap).scene_type, "form");
  });

  it("无元素 → loading", () => {
    const snap = makeSnapshot({ interactiveElements: [] });
    assert.equal(narratePage(snap).scene_type, "loading");
  });

  it("普通页面 → generic", () => {
    const snap = makeSnapshot({
      interactiveElements: [makeEl({ tag: "a", text: "首页" })],
    });
    assert.equal(narratePage(snap).scene_type, "generic");
  });
});

// ─── narratePage: 返回结构 ─────────────────────────────────────────

describe("narratePage — 返回结构", () => {
  it("包含所有必需字段", () => {
    const snap = makeSnapshot({ url: "https://example.com", title: "Test" });
    const n = narratePage(snap);
    for (const key of ["scene_type", "url", "title", "scroll_y", "scroll_height", "has_more", "key_elements", "all_count", "text_excerpt", "diff"]) {
      assert.ok(key in n, `missing key: ${key}`);
    }
  });

  it("url / title 原样返回", () => {
    const snap = makeSnapshot({ url: "https://foo.com/bar", title: "Foo Page" });
    const n = narratePage(snap);
    assert.equal(n.url, "https://foo.com/bar");
    assert.equal(n.title, "Foo Page");
  });

  it("all_count 等于 interactiveElements 长度", () => {
    const snap = makeSnapshot({ interactiveElements: [makeEl(), makeEl({ index: 2 }), makeEl({ index: 3 })] });
    assert.equal(narratePage(snap).all_count, 3);
  });

  it("key_elements 最多 12 个", () => {
    const els = Array.from({ length: 20 }, (_, i) => makeEl({ index: i + 1, tag: "button", text: `btn${i}` }));
    const snap = makeSnapshot({ interactiveElements: els });
    assert.ok(narratePage(snap).key_elements.length <= 12);
  });

  it("无 prevSnapshot 时 diff 为 null", () => {
    assert.equal(narratePage(makeSnapshot()).diff, null);
  });

  it("text_excerpt 截取自 pageText", () => {
    const snap = makeSnapshot({ pageText: "Hello world" });
    assert.ok(narratePage(snap).text_excerpt.includes("Hello world"));
  });
});

// ─── narratePage: 元素评分 ────────────────────────────────────────

describe("narratePage — 元素评分 (key_elements 排序)", () => {
  it("button 优先于 link", () => {
    const snap = makeSnapshot({
      interactiveElements: [
        makeEl({ index: 1, tag: "a",      text: "点我" }),
        makeEl({ index: 2, tag: "button", text: "提交" }),
      ],
    });
    const keys = narratePage(snap).key_elements;
    // key_elements 恢复原始顺序，但两个都应该在里面
    assert.ok(keys.some(e => e.tag === "button"));
    assert.ok(keys.some(e => e.tag === "a"));
  });

  it("高价值关键词（搜索/提交）得额外分", () => {
    const snap = makeSnapshot({
      interactiveElements: [
        makeEl({ index: 1, tag: "a",      text: "随便" }),
        makeEl({ index: 2, tag: "button", text: "搜索" }),
        makeEl({ index: 3, tag: "button", text: "提交" }),
      ],
    });
    const keys = narratePage(snap).key_elements;
    // 搜索/提交 应出现在 key_elements 里
    assert.ok(keys.some(e => e.text === "搜索"));
    assert.ok(keys.some(e => e.text === "提交"));
  });

  it("failureCount 高的元素得分降低（可能被挤出 key_elements）", () => {
    const els = [
      makeEl({ index: 1, tag: "button", text: "失败按钮", failureCount: 10 }),
      ...Array.from({ length: 12 }, (_, i) => makeEl({ index: i + 2, tag: "button", text: `btn${i}` })),
    ];
    const snap = makeSnapshot({ interactiveElements: els });
    const keys = narratePage(snap).key_elements;
    // 高 failureCount 的按钮不应出现在 key_elements 中
    assert.ok(!keys.some(e => e.text === "失败按钮"));
  });
});

// ─── narratePage: diff ────────────────────────────────────────────

describe("narratePage — diffSnapshots", () => {
  it("URL 变化被检测到", () => {
    const prev = makeSnapshot({ url: "https://a.com" });
    const curr = makeSnapshot({ url: "https://b.com" });
    const diff = narratePage(curr, prev).diff;
    assert.equal(diff.url_changed, true);
  });

  it("URL 未变化时 url_changed = false", () => {
    const snap = makeSnapshot({ url: "https://a.com" });
    const diff = narratePage(snap, snap).diff;
    assert.equal(diff.url_changed, false);
  });

  it("标题变化被检测到", () => {
    const prev = makeSnapshot({ title: "Page A" });
    const curr = makeSnapshot({ title: "Page B" });
    assert.equal(narratePage(curr, prev).diff.title_changed, true);
  });

  it("元素数量变化被记录", () => {
    const prev = makeSnapshot({ interactiveElements: [makeEl()] });
    const curr = makeSnapshot({ interactiveElements: [makeEl(), makeEl({ index: 2 }), makeEl({ index: 3 })] });
    assert.equal(narratePage(curr, prev).diff.elements_delta, 2);
  });

  it("滚动超过 10px 标记为 scroll_moved", () => {
    const prev = makeSnapshot({ scrollPosition: { y: 0, scrollHeight: 1000 } });
    const curr = makeSnapshot({ scrollPosition: { y: 500, scrollHeight: 1000 } });
    assert.equal(narratePage(curr, prev).diff.scroll_moved, true);
  });

  it("滚动 ≤ 10px 不标记 scroll_moved", () => {
    const prev = makeSnapshot({ scrollPosition: { y: 0, scrollHeight: 1000 } });
    const curr = makeSnapshot({ scrollPosition: { y: 5, scrollHeight: 1000 } });
    assert.equal(narratePage(curr, prev).diff.scroll_moved, false);
  });
});

// ─── formatNarration ──────────────────────────────────────────────

describe("formatNarration — 格式化输出", () => {
  it("包含 URL 和标题", () => {
    const snap = makeSnapshot({ url: "https://test.com", title: "测试" });
    const n = narratePage(snap);
    const out = formatNarration(n, snap.interactiveElements);
    assert.ok(out.includes("https://test.com"));
    assert.ok(out.includes("测试"));
  });

  it("包含场景类型", () => {
    const snap = makeSnapshot({ url: "https://x.com/login" });
    const n = narratePage(snap);
    const out = formatNarration(n, snap.interactiveElements);
    assert.ok(out.includes("login"));
  });

  it("包含关键元素 index", () => {
    const snap = makeSnapshot({
      interactiveElements: [makeEl({ index: 7, tag: "button", text: "确认" })],
    });
    const n = narratePage(snap);
    const out = formatNarration(n, snap.interactiveElements);
    assert.ok(out.includes("[7]"));
    assert.ok(out.includes("确认"));
  });

  it("has_more=true 时显示滚动提示", () => {
    const snap = makeSnapshot({ hasMoreContent: true });
    const n = narratePage(snap);
    const out = formatNarration(n, snap.interactiveElements);
    assert.ok(out.includes("更多"));
  });

  it("has_more=false 时显示已全部可见", () => {
    const snap = makeSnapshot({ hasMoreContent: false });
    const n = narratePage(snap);
    const out = formatNarration(n, snap.interactiveElements);
    assert.ok(out.includes("全部可见") || out.includes("已到底部"));
  });

  it("有 diff 时显示变化摘要", () => {
    const prev = makeSnapshot({ url: "https://a.com" });
    const curr = makeSnapshot({ url: "https://b.com" });
    const n = narratePage(curr, prev);
    const out = formatNarration(n, curr.interactiveElements);
    assert.ok(out.includes("URL 已变化"));
  });

  it("页面无变化时有提示语", () => {
    const snap = makeSnapshot();
    const n = narratePage(snap, snap);
    const out = formatNarration(n, snap.interactiveElements);
    assert.ok(out.includes("无明显变化") || out.includes("未生效"));
  });

  it("失败过的元素标有警告", () => {
    const snap = makeSnapshot({
      interactiveElements: [makeEl({ index: 1, tag: "button", text: "失败按钮", failureCount: 2 })],
    });
    const n = narratePage(snap);
    const out = formatNarration(n, snap.interactiveElements);
    assert.ok(out.includes("失败") || out.includes("⚠"));
  });
});
