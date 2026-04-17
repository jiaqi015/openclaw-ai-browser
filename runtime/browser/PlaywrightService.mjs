/**
 * PlaywrightService.mjs
 * 管理 Playwright 与 Electron Chromium 的 CDP 连接。
 * 替代 CdpDriverService 的连接层。
 */

import { chromium } from "playwright-core";

const DEBUG_PORT = process.env.SABRINA_DEBUG_PORT || "9229";
let _browser = null;

/**
 * 获取（或重新建立）Playwright Browser 连接。
 * connectOverCDP 连接到 Electron 启动时开放的 --remote-debugging-port。
 */
export async function getPlaywrightBrowser() {
  if (_browser?.isConnected()) return _browser;

  try {
    _browser = await chromium.connectOverCDP(`http://localhost:${DEBUG_PORT}`);
    _browser.on("disconnected", () => {
      console.warn("[Playwright] Browser disconnected — will reconnect on next use");
      _browser = null;
    });
    console.log(`[Playwright] Connected to Electron Chromium on port ${DEBUG_PORT}`);
    return _browser;
  } catch (err) {
    _browser = null;
    throw new Error(`[Playwright] Cannot connect to Electron (port ${DEBUG_PORT}): ${err.message}`);
  }
}

/**
 * 获取与指定 Electron webContents 对应的 Playwright Page。
 * 以 URL 精确匹配为主，降级取第一个可用 page。
 */
export async function getPlaywrightPage(webContents) {
  if (!webContents || webContents.isDestroyed()) {
    throw new Error("[Playwright] webContents is not available");
  }

  const browser = await getPlaywrightBrowser();
  const targetUrl = webContents.getURL?.() || "";

  // 遍历所有 context 下的 page，按 URL 匹配
  for (const ctx of browser.contexts()) {
    for (const page of ctx.pages()) {
      if (page.url() === targetUrl) return page;
    }
  }

  // 降级：返回第一个非空 page
  const allPages = browser.contexts().flatMap(ctx => ctx.pages());
  if (allPages.length > 0) {
    console.warn(`[Playwright] No page matched URL "${targetUrl}", using first available page`);
    return allPages[0];
  }

  throw new Error(`[Playwright] No pages found in Electron Chromium`);
}
