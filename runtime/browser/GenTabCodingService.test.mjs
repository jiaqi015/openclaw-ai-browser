import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCodingGenTabPrompt,
  buildCodingGenTabRefinementPrompt,
  buildCodingGenTabVerifyPrompt,
  normalizeCodingGenTabResult,
  normalizeCodingGenTabVerifyResult,
} from "./GenTabCodingService.mjs";

// Minimal valid HTML: must be > 100 chars to pass the length gate
const VALID_HTML = `<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><title>GPU</title></head><body><h1>GPU 决斗台</h1><p>RTX 4090 vs RTX 4080 — 帮你选一张</p></body></html>`;

test("buildCodingGenTabPrompt: contains user intent and context", () => {
  const prompt = buildCodingGenTabPrompt(
    "比较三张 GPU",
    [
      { title: "RTX 4090 商品页", url: "https://store.com/4090", contentText: "RTX 4090 价格 ¥12999 显存 24GB" },
      { title: "RTX 4080 商品页", url: "https://store.com/4080", contentText: "RTX 4080 价格 ¥8499 显存 16GB" },
    ],
  );
  assert.match(prompt, /比较三张 GPU/);
  assert.match(prompt, /RTX 4090/);
  assert.match(prompt, /RTX 4080/);
  // Prompt should instruct agent to think creatively, not just format data
  assert.match(prompt, /创作/);
  // Output schema fields present
  assert.match(prompt, /designChoice/);
  assert.match(prompt, /"html"/);
});

test("buildCodingGenTabPrompt: surfaces key facts (prices, specs) prominently", () => {
  const prompt = buildCodingGenTabPrompt(
    "GPU 对比",
    [
      {
        title: "RTX 4090",
        url: "https://store.com/4090",
        contentText: "RTX 4090 售价 ¥12999 显存 24GB TDP 450W 评分 9.2分/10",
        sections: [],
      },
    ],
  );
  // Key facts should be extracted and surfaced
  assert.match(prompt, /关键数值/);
  assert.match(prompt, /¥12999/);
  assert.match(prompt, /24GB/);
  assert.match(prompt, /450W/);
});

test("buildCodingGenTabPrompt: uses sections when available instead of raw contentText", () => {
  const prompt = buildCodingGenTabPrompt(
    "了解产品",
    [
      {
        title: "产品页",
        url: "https://example.com",
        contentText: "噪音很多的原始文字".repeat(500), // lots of noise
        sections: [
          { title: "产品规格", summary: "内存 16GB，处理器 M3 Pro，续航 18小时" },
          { title: "价格方案", summary: "标准版 ¥9999，高配版 ¥13999" },
        ],
      },
    ],
  );
  assert.match(prompt, /产品规格/);
  assert.match(prompt, /16GB/);
  assert.match(prompt, /¥9999/);
  // Should prefer sections over raw dump
  assert.match(prompt, /页面章节/);
});

test("buildCodingGenTabPrompt: uses meta description when present", () => {
  const prompt = buildCodingGenTabPrompt(
    "了解这家餐厅",
    [
      {
        title: "米其林餐厅",
        url: "https://example.com",
        contentText: "some content",
        metadata: { description: "北京顶级日料，人均1500元，预订需提前两周" },
      },
    ],
  );
  assert.match(prompt, /简介/);
  assert.match(prompt, /北京顶级日料/);
});

test("buildCodingGenTabPrompt: handles missing context gracefully", () => {
  const prompt = buildCodingGenTabPrompt("do something", []);
  assert.match(prompt, /do something/);
  assert.match(prompt, /无网页内容/);
});

test("normalizeCodingGenTabResult: parses valid JSON with HTML", () => {
  const rawJson = JSON.stringify({
    success: true,
    title: "GPU 决斗台",
    intent: "帮你从三家中挑一张 RTX 4090",
    designChoice: "三张卡片 + 一个帮我选按钮",
    html: VALID_HTML,
  });
  const result = normalizeCodingGenTabResult(rawJson, { sourceTabIds: ["t1", "t2"], userIntent: "买 GPU" });
  assert.equal(result?.success, true);
  assert.equal(result?.title, "GPU 决斗台");
  assert.equal(result?.schemaVersion, "coding");
  assert.equal(result?.type, "coding");
  assert.ok(result?.html?.includes("<html"));
  assert.deepEqual(result?.metadata?.sourceTabIds, ["t1", "t2"]);
  assert.equal(result?.metadata?.userIntent, "买 GPU");
});

test("normalizeCodingGenTabResult: rescues bare HTML when agent forgets JSON", () => {
  const bareHtml = `Here is the page:\n${VALID_HTML}\n`;
  const result = normalizeCodingGenTabResult(bareHtml, { sourceTabIds: [], userIntent: "" });
  assert.equal(result?.success, true);
  assert.ok(result?.html?.includes("<html"));
});

test("normalizeCodingGenTabResult: returns null for empty / null input", () => {
  assert.equal(normalizeCodingGenTabResult("", {}), null);
  assert.equal(normalizeCodingGenTabResult(null, {}), null);
  assert.equal(normalizeCodingGenTabResult("   ", {}), null);
});

test("normalizeCodingGenTabResult: surfaces model refusal cleanly", () => {
  const refusal = JSON.stringify({ success: false, error: "页面内容不足以生成" });
  const result = normalizeCodingGenTabResult(refusal, {});
  assert.equal(result?.success, false);
  assert.match(result?.error ?? "", /不足/);
});

test("normalizeCodingGenTabResult: strips markdown code fences", () => {
  const wrapped =
    "```json\n" +
    JSON.stringify({
      success: true,
      title: "T",
      intent: "i",
      designChoice: "d",
      html: VALID_HTML,
    }) +
    "\n```";
  const result = normalizeCodingGenTabResult(wrapped, {});
  assert.equal(result?.success, true);
  assert.equal(result?.title, "T");
});

test("normalizeCodingGenTabResult: rejects HTML that is too short to be real", () => {
  const tiny = JSON.stringify({ success: true, title: "T", intent: "i", designChoice: "d", html: "<p>hi</p>" });
  const result = normalizeCodingGenTabResult(tiny, {});
  // <p>hi</p> is 9 chars, well below 100 char threshold
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// buildCodingGenTabRefinementPrompt tests
// ---------------------------------------------------------------------------

test("buildCodingGenTabRefinementPrompt: contains refinement instruction and original HTML", () => {
  const originalHtml = VALID_HTML;
  const prompt = buildCodingGenTabRefinementPrompt(
    "把背景色改成白色",
    originalHtml,
    [{ title: "Apple Music", url: "https://music.apple.com", contentText: "热门歌单" }],
  );
  assert.ok(prompt.includes("把背景色改成白色"), "should contain refinement instruction");
  assert.ok(prompt.includes(originalHtml), "should contain original HTML for reference");
  assert.ok(prompt.includes("Apple Music"), "should include page context");
  assert.ok(prompt.includes("最小改动"), "should instruct minimal diff");
});

test("buildCodingGenTabRefinementPrompt: truncates very long HTML", () => {
  const longHtml = "A".repeat(50_000);
  const prompt = buildCodingGenTabRefinementPrompt("改成英文", longHtml, []);
  assert.ok(prompt.includes("truncated"), "should note truncation for very long HTML");
  assert.ok(prompt.length < 80_000, "total prompt should be manageable size");
});

test("buildCodingGenTabRefinementPrompt: handles missing context gracefully", () => {
  const prompt = buildCodingGenTabRefinementPrompt("加一个动画", VALID_HTML, null);
  assert.ok(prompt.includes("加一个动画"));
  assert.ok(prompt.includes("无网页内容"));
});

// ---------------------------------------------------------------------------
// buildCodingGenTabVerifyPrompt tests
// ---------------------------------------------------------------------------

test("buildCodingGenTabVerifyPrompt: contains the generated HTML and context", () => {
  const prompt = buildCodingGenTabVerifyPrompt(
    VALID_HTML,
    [{ title: "RTX 4090", url: "https://store.com/4090", contentText: "价格 ¥12999" }],
  );
  assert.ok(prompt.includes(VALID_HTML), "should include the HTML to verify");
  assert.ok(prompt.includes("RTX 4090"), "should include context for data cross-check");
  assert.ok(prompt.includes("数据准确"), "should mention data accuracy check");
  assert.ok(prompt.includes("交互可用"), "should mention interaction check");
  assert.ok(prompt.includes("占位符"), "should mention placeholder check");
});

test("buildCodingGenTabVerifyPrompt: truncates very long HTML", () => {
  const longHtml = "A".repeat(50_000);
  const prompt = buildCodingGenTabVerifyPrompt(longHtml, []);
  assert.ok(prompt.includes("truncated"), "should mark truncation");
  assert.ok(prompt.length < 100_000, "total prompt should be manageable");
});

test("buildCodingGenTabVerifyPrompt: handles empty context gracefully", () => {
  const prompt = buildCodingGenTabVerifyPrompt(VALID_HTML, []);
  assert.ok(prompt.includes("无网页内容"));
});

// ---------------------------------------------------------------------------
// normalizeCodingGenTabVerifyResult tests
// ---------------------------------------------------------------------------

test("normalizeCodingGenTabVerifyResult: parses ok:true", () => {
  const result = normalizeCodingGenTabVerifyResult(JSON.stringify({ ok: true }));
  assert.deepEqual(result, { ok: true });
});

test("normalizeCodingGenTabVerifyResult: parses ok:false with fixed HTML", () => {
  const result = normalizeCodingGenTabVerifyResult(JSON.stringify({
    ok: false,
    fixes: ["修复了价格数据"],
    html: VALID_HTML,
  }));
  assert.equal(result?.ok, false);
  assert.ok(result?.html?.includes("<html"));
});

test("normalizeCodingGenTabVerifyResult: treats ok:false without usable HTML as ok:true (fail safe)", () => {
  // If the verifier says there are issues but can't produce fixed HTML, don't break delivery
  const result = normalizeCodingGenTabVerifyResult(JSON.stringify({ ok: false, fixes: ["oops"] }));
  assert.deepEqual(result, { ok: true });
});

test("normalizeCodingGenTabVerifyResult: strips markdown code fences", () => {
  const wrapped = "```json\n" + JSON.stringify({ ok: true }) + "\n```";
  const result = normalizeCodingGenTabVerifyResult(wrapped);
  assert.deepEqual(result, { ok: true });
});

test("normalizeCodingGenTabVerifyResult: returns null for empty/null input", () => {
  assert.equal(normalizeCodingGenTabVerifyResult(""), null);
  assert.equal(normalizeCodingGenTabVerifyResult(null), null);
  assert.equal(normalizeCodingGenTabVerifyResult("   "), null);
});

test("normalizeCodingGenTabVerifyResult: returns null for unparseable output", () => {
  assert.equal(normalizeCodingGenTabVerifyResult("sorry I can't do that"), null);
});
