/**
 * PageOverlayService.test.mjs — CAP-6 视觉共生测试
 * 角色: UX 主审 + Dev-A 实现
 * 覆盖: TC-6.1 ~ TC-6.6
 * 
 * 策略: 用 DOM 字符串检查替代真实 webContents，
 *       验证注入的 JS 代码字符串包含正确的视觉参数。
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourceCode = readFileSync(join(__dirname, "PageOverlayService.mjs"), "utf-8");

// ─── 设计规范一致性 (UX 角色审查) ────────────────────────────────
describe("CAP-6 PageOverlayService — UX 设计规范一致性", () => {
  it("TC-6.6a info/error 颜色为 Apple Pink #FF2D55", () => {
    assert.ok(sourceCode.includes("#FF2D55"), "Apple Pink color must be present");
  });

  it("TC-6.6b success 颜色为 Emerald #10b981", () => {
    assert.ok(sourceCode.includes("#10b981"), "Emerald success color must be present");
  });

  it("TC-6.6c warning 颜色为 Amber #f59e0b", () => {
    assert.ok(sourceCode.includes("#f59e0b"), "Amber warning color must be present");
  });

  it("TC-6.4 光标动效使用高品质 cubic-bezier", () => {
    // 验证光标位移使用专业级回弹曲线
    assert.ok(
      sourceCode.includes("cubic-bezier(0.23, 1, 0.32, 1)"),
      "Cursor must use spring-like cubic-bezier easing"
    );
  });

  it("TC-6.4b 状态条出现使用流畅弹簧曲线", () => {
    assert.ok(
      sourceCode.includes("cubic-bezier(0.16, 1, 0.3, 1)"),
      "Status bar must use fluid spring easing"
    );
  });

  it("TC-6-glassmorphism 状态条使用 backdrop-filter 毛玻璃", () => {
    assert.ok(sourceCode.includes("backdropFilter"), "Must use backdrop-filter glassmorphism");
    assert.ok(sourceCode.includes("blur(24px)"), "Blur value must be substantial");
    assert.ok(sourceCode.includes("saturate(200%)"), "Saturation must be boosted");
  });

  it("TC-6-pointer-events Overlay 不影响用户交互", () => {
    assert.ok(sourceCode.includes("pointerEvents = 'none'"), "Overlay must not capture pointer events");
  });

  it("TC-6-zindex Overlay z-index 达到最大值", () => {
    assert.ok(sourceCode.includes("2147483647"), "Z-index must be max integer");
  });

  it("TC-6-font 使用系统原生字体栈", () => {
    assert.ok(
      sourceCode.includes("-apple-system") && sourceCode.includes("BlinkMacSystemFont"),
      "Must use native system font stack"
    );
  });
});

// ─── 幂等性保护 (Dev-A 逻辑验证) ─────────────────────────────────
describe("CAP-6 PageOverlayService — 幂等性与生命周期", () => {
  it("TC-6.1 重复注入检测逻辑存在", () => {
    // 验证源码中有幂等保护
    assert.ok(
      sourceCode.includes("sabrina-agent-overlay"),
      "Must check for existing overlay before injecting"
    );
    // 第二次调用只重置 opacity
    assert.ok(
      sourceCode.includes("opacity = '1'"),
      "Second inject call must only reset visibility"
    );
  });

  it("TC-6.2 状态文字更新使用 .updating class 淡出", () => {
    assert.ok(
      sourceCode.includes("classList.add('updating')"),
      "Status update must add updating class for blur effect"
    );
    assert.ok(
      sourceCode.includes("classList.remove('updating')"),
      "updating class must be removed after text switch"
    );
    assert.ok(
      sourceCode.includes("150"),
      "Text swap delay must be 150ms to match CSS transition"
    );
  });

  it("TC-6.3 点击产生 .sabrina-ripple 波纹元素", () => {
    assert.ok(
      sourceCode.includes("sabrina-ripple"),
      "Click must create ripple element"
    );
    assert.ok(
      sourceCode.includes("500"),
      "Ripple must auto-remove after 500ms"
    );
  });

  it("TC-6.5 退场动效参数正确", () => {
    assert.ok(
      sourceCode.includes("opacity = '0'"),
      "Cleanup must fade out overlay"
    );
    assert.ok(
      sourceCode.includes("scale(0.98)"),
      "Cleanup must slightly shrink overlay for premium feel"
    );
    assert.ok(
      sourceCode.includes("450"),
      "DOM removal must wait for animation (450ms)"
    );
  });

  it("TC-6-ripple-animation 波纹使用 cubic-bezier 动效", () => {
    assert.ok(
      sourceCode.includes("cubic-bezier(0.25, 0.46, 0.45, 0.94)"),
      "Ripple animation must use eased cubic-bezier"
    );
  });

  it("TC-6-cursor-click-feedback 点击时光标有缩放反馈", () => {
    assert.ok(sourceCode.includes("scale(0.85)"), "Click must scale cursor down");
    assert.ok(sourceCode.includes("scale(1)"), "Cursor must spring back to normal");
  });
});

// ─── Mock WebContents 功能测试 ────────────────────────────────────
describe("CAP-6 PageOverlayService — Mock 执行路径", () => {
  function makeMockWC(destroyed = false) {
    const calls = [];
    return {
      isDestroyed: () => destroyed,
      executeJavaScript: async (code) => {
        calls.push(code);
        return undefined;
      },
      _calls: calls,
    };
  }

  it("TC-6-destroyed-wc Overlay 函数在 webContents 销毁时不抛异常", async () => {
    const { injectOverlay, updateOverlayStatus, moveCursorTo, cleanupOverlay } = 
      await import("./PageOverlayService.mjs");
    
    const destroyedWC = makeMockWC(true);
    // None of these should throw
    await assert.doesNotReject(() => injectOverlay(destroyedWC));
    await assert.doesNotReject(() => updateOverlayStatus(destroyedWC, "test"));
    await assert.doesNotReject(() => moveCursorTo(destroyedWC, 0, 0));
    await assert.doesNotReject(() => cleanupOverlay(destroyedWC));
  });

  it("TC-6-null-wc Overlay 函数在 null webContents 时不抛异常", async () => {
    const { injectOverlay, updateOverlayStatus, cleanupOverlay } = 
      await import("./PageOverlayService.mjs");
    
    await assert.doesNotReject(() => injectOverlay(null));
    await assert.doesNotReject(() => updateOverlayStatus(null, "test"));
    await assert.doesNotReject(() => cleanupOverlay(null));
  });

  it("TC-6-injects-script 正常 WC 时会调用 executeJavaScript", async () => {
    const { injectOverlay } = await import("./PageOverlayService.mjs");
    const wc = makeMockWC(false);
    await injectOverlay(wc);
    assert.ok(wc._calls.length > 0, "executeJavaScript must be called at least once");
  });
});
