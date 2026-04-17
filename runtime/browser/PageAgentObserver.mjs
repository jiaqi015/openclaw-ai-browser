import { cdpDriver } from "./CdpDriverService.mjs";
import { parseCdpSnapshot } from "./SnapshotParser.mjs";

/**
 * PageAgentObserver.mjs
 * 观察层：结合 DOM 与 CDP AXTree 提供高精度语义快照。
 */

/**
 * Watchman：等待页面达到可用状态
 * 解决 SPA 懒加载、首次加载未完成就观察导致空快照的问题
 */
export async function waitForPageStable(webContents, { timeout = 8000, minElements = 3 } = {}) {
  if (!webContents || webContents.isDestroyed()) return;

  const deadline = Date.now() + timeout;

  // 阶段 1：等待 DOM 至少进入 interactive
  await new Promise(resolve => {
    const check = async () => {
      try {
        const result = await cdpDriver.sendCommand(webContents, 'Runtime.evaluate', {
          expression: 'document.readyState',
          returnByValue: true
        });
        const state = result?.result?.value;
        if (state === 'interactive' || state === 'complete') return resolve();
      } catch {}
      if (Date.now() < deadline) setTimeout(check, 200);
      else resolve();
    };
    check();
  });

  // 阶段 2：等待网络静默 500ms（最长 5 秒，不阻塞主流程）
  await cdpDriver.waitForNetworkIdle(webContents, Math.min(5000, deadline - Date.now()), 500).catch(() => {});

  // 阶段 3：等待页面有足够的交互元素（避免空快照）
  for (let i = 0; i < 10 && Date.now() < deadline; i++) {
    try {
      const result = await cdpDriver.sendCommand(webContents, 'Runtime.evaluate', {
        expression: `document.querySelectorAll('a,button,input,select,textarea,[role="button"],[role="link"],[tabindex]').length`,
        returnByValue: true
      });
      const count = result?.result?.value || 0;
      if (count >= minElements) break;
    } catch {}
    await new Promise(r => setTimeout(r, 300));
  }
}

export async function observePage(webContents) {
  if (!webContents || webContents.isDestroyed()) {
    throw new Error("webContents is not available");
  }

  // 1. 获取 CDP AXTree 语义数据
  let axNodes = [];
  try {
    const { axNodes: rawAx } = await cdpDriver.getAXTree(webContents); // getAXTree 返回 { axNodes, domRoot }
    axNodes = (rawAx || []).filter(n => {
      if (!n.name?.value) return false;
      const role = n.role?.value || "";
      const noiseRoles = ["genericContainer", "StaticText", "LineBreak", "WebArea", "RootWebArea"];
      return !noiseRoles.includes(role);
    }).map(n => ({
      name: n.name.value,
      role: n.role?.value,
      description: n.description?.value
    }));
    console.log(`[Observer] AXTree: ${rawAx?.length ?? 0} -> ${axNodes.length} semantic nodes`);
  } catch (err) {
    console.warn("[Observer] Failed to fetch AXTree, falling back to pure DOM scan:", err);
  }

  // 2. 获取原生 CDP 快照 (Native Sense) - 最多 3 次重试，间隔递增（200ms/400ms）
  let cdpData = null;
  for (let i = 0; i < 3; i++) {
    try {
      cdpData = await cdpDriver.captureSnapshot(webContents);
      if (cdpData?.documents?.length > 0) break;
    } catch (e) {
      console.warn(`[Observer] CDP Capture attempt ${i + 1} failed, retrying...`);
    }
    if (i < 2) await new Promise(r => setTimeout(r, 200 * (i + 1)));
  }

  // 3. 解析为标准快照格式并注入语义增强 (Parser & Fusion)
  const snapshot = parseCdpSnapshot(cdpData);

  if (!snapshot) {
    throw new Error("未能获取页面原生快照 (CDP 响应超时或为空)");
  }

  // 4. 补齐字段（tabId、真实滚动位置）
  snapshot.tabId = webContents.id;
  if (!snapshot.url) snapshot.url = webContents.getURL?.() || "";
  if (!snapshot.title) snapshot.title = webContents.getTitle?.() || "";

  // 4b. 获取真实滚动位置（SnapshotParser 返回的是硬编码 0）
  try {
    const scrollRes = await cdpDriver.sendCommand(webContents, 'Runtime.evaluate', {
      expression: '({ y: window.scrollY, scrollHeight: document.documentElement.scrollHeight, clientHeight: window.innerHeight })',
      returnByValue: true
    });
    const s = scrollRes?.result?.value;
    if (s) {
      snapshot.scrollPosition = { y: s.y, scrollHeight: s.scrollHeight };
      // 距底部 > 150px 说明还有更多内容可以向下滚动
      snapshot.hasMoreContent = (s.y + s.clientHeight) < (s.scrollHeight - 150);
    }
  } catch {
    snapshot.scrollPosition = snapshot.scrollPosition || { y: 0, scrollHeight: 0 };
    snapshot.hasMoreContent = false;
  }

  // 5. 挂载 AXTree 供大脑选读
  snapshot.axNodes = axNodes;

  return snapshot;
}
