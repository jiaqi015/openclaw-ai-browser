/**
 * PlaywrightObserver.mjs
 * 观察层：替代 PageAgentObserver + SnapshotParser + CdpDriverService 的感知部分。
 *
 * 核心改变：
 *   - 用 page.waitForLoadState('networkidle') 替代手写 Watchman
 *   - 用 page.evaluate() 直接从 DOM 获取元素（坐标永远是 viewport-relative）
 *   - 不再需要 DOMSnapshot + AXTree + 坐标映射
 */

import { getPlaywrightPage } from "./PlaywrightService.mjs";

/**
 * 等待页面稳定（首步全量等待，后续步骤轻量等待）。
 * @param {Electron.WebContents} webContents
 * @param {{ full?: boolean, timeout?: number }} options
 */
export async function waitForPageReady(webContents, { full = false, timeout = 8000 } = {}) {
  const page = await getPlaywrightPage(webContents);
  const state = full ? "networkidle" : "domcontentloaded";
  await page.waitForLoadState(state, { timeout }).catch(() => {
    // 超时不抛出，允许继续观察
  });
}

/**
 * 观察当前页面，返回与原 observePage() 兼容的快照格式。
 * @param {Electron.WebContents} webContents
 * @returns {Promise<object>} snapshot
 */
export async function observePage(webContents) {
  if (!webContents || webContents.isDestroyed()) {
    throw new Error("webContents is not available");
  }

  const page = await getPlaywrightPage(webContents);

  // 1. 给所有可见可交互元素打上临时序号（本步骤有效，导航后重置）
  await page.evaluate(() => {
    let idx = 0;
    const selector = [
      "a[href]", "button", "input", "select", "textarea",
      '[role="button"]', '[role="link"]', '[role="checkbox"]',
      '[role="radio"]', '[role="tab"]', '[role="menuitem"]',
      '[role="option"]', '[role="combobox"]', '[role="searchbox"]',
      '[tabindex="0"]',
    ].join(",");

    document.querySelectorAll(selector).forEach(el => {
      // 跳过不可见元素
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      // 跳过视口外很远的元素（可能未渲染）
      if (r.bottom < -500 || r.top > window.innerHeight + 500) return;
      idx++;
      el.dataset.sabrinaIdx = String(idx);
    });
  });

  // 2. 收集元素信息（坐标已是 viewport-relative，Playwright 保证）
  const interactiveElements = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("[data-sabrina-idx]")).map(el => {
      const r = el.getBoundingClientRect();
      const tag = el.tagName.toLowerCase();
      const type = (el.type || "").toLowerCase();
      const rawText = (
        el.textContent?.trim() ||
        el.value ||
        el.placeholder ||
        el.title ||
        el.getAttribute("aria-label") ||
        ""
      ).replace(/\s+/g, " ").slice(0, 150);

      return {
        index:       parseInt(el.dataset.sabrinaIdx),
        tag,
        type,
        text:        rawText,
        value:       el.value || "",
        placeholder: el.placeholder || "",
        disabled:    el.disabled || el.getAttribute("aria-disabled") === "true",
        failureCount: 0,
        rect: {
          x: Math.round(r.left),
          y: Math.round(r.top),
          w: Math.round(r.width),
          h: Math.round(r.height),
        },
      };
    });
  });

  // 3. 滚动状态 + 页面文字
  const { scrollY, scrollHeight, clientHeight, pageText } = await page.evaluate(() => ({
    scrollY:      window.scrollY,
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: window.innerHeight,
    pageText:     document.body?.innerText?.slice(0, 5000) || "",
  }));

  return {
    url:   page.url(),
    title: await page.title(),
    interactiveElements,
    pageText,
    scrollPosition: { y: scrollY, scrollHeight },
    hasMoreContent: (scrollY + clientHeight) < (scrollHeight - 150),
    tabId: webContents.id,
    axNodes: [], // Playwright 模式不需要 AXTree（页面文字 + 元素语义已足够）
  };
}
