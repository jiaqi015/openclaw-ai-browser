import { observePage, waitForPageReady } from "./PlaywrightObserver.mjs";
import { executeAction } from "./PlaywrightExecutor.mjs";
import { classifyAction, getConfirmReason } from "./ActionGate.mjs";
import { buildAgentPrompt, parseAgentAction } from "./BrowserAgentPromptService.mjs";
import { narratePage } from "./PageNarratorService.mjs";
import { resolveActionElement } from "./PageLocatorService.mjs";
import { injectOverlay, updateOverlayStatus, moveCursorTo, cleanupOverlay } from "./PageOverlayService.mjs";
import { getPlaywrightPage } from "./PlaywrightService.mjs";

const MAX_STEPS = 20;
const MAX_CONSECUTIVE_ERRORS = 3;

export async function runBrowserAgent(params, dependencies) {
  const {
    tabId,
    task,
    userData,
    sendProgress,
    requestConfirm,
    signal, // AbortSignal
    sessionId // 跨步骤的持久 OpenClaw session，给大脑记忆
  } = params;
  
  const { 
    runLocalAgentTurn, 
    getWebContentsByTabId 
  } = dependencies;

  const webContents = getWebContentsByTabId(tabId);
  if (!webContents) {
    throw new Error(`Tab not found: ${tabId}`);
  }

  const journal = [];
  const warnings = [];
  let consecutiveErrors = 0;

  try {
    let currentTabId = tabId;
    let currentWebContents = webContents;

    // 初始化视觉图层
    await injectOverlay(currentWebContents);
    await updateOverlayStatus(currentWebContents, "正在启动 Sabrina Agent...");

    for (let step = 1; step <= MAX_STEPS; step++) {

      // 0. 标签页切换跟踪
      const activeTabId = dependencies.getActiveTabId?.();
      if (activeTabId && activeTabId !== currentTabId) {
        console.log(`[Agent] Pivoting focus from ${currentTabId} to ${activeTabId}`);
        await cleanupOverlay(currentWebContents);
        currentTabId = activeTabId;
        currentWebContents = dependencies.getWebContentsByTabId(currentTabId);
        await injectOverlay(currentWebContents);
      }

      // 检查中断/生命周期
      if (signal?.aborted || !currentWebContents || currentWebContents.isDestroyed()) {
        await cleanupOverlay(currentWebContents);
        return {
          ok: false,
          journal,
          error: signal?.aborted ? "任务已取消" : "标签页已丢失",
          warnings: collectWarnings(journal, warnings),
        };
      }

      try {
        // 1. 等待页面就绪（Playwright waitForLoadState 替代手写 Watchman）
        await updateOverlayStatus(currentWebContents, "等待页面就绪...");
        await waitForPageReady(currentWebContents, { full: step === 1, timeout: 8000 });

        // 2. 观察
        await updateOverlayStatus(currentWebContents, "正在观察页面...");
        sendProgress({ type: "observe", step });
        const snapshot = await observePage(currentWebContents);

        // 2b. Narrator
        const prevSnapshot = journal.length > 0 ? journal[journal.length - 1]._snapshot : null;
        const narration = narratePage(snapshot, prevSnapshot);

        // 3. 思考
        await updateOverlayStatus(currentWebContents, "正在思考下一步...");
        const prompt = buildAgentPrompt(task, snapshot, journal, userData, narration);
        sendProgress({ type: "think", step });
        const llmRaw = await runLocalAgentTurn({ message: prompt, sessionId }, dependencies);
        const llmResponse = (typeof llmRaw === 'object' && llmRaw !== null)
          ? (llmRaw.text || llmRaw.content || llmRaw.message || "")
          : String(llmRaw ?? "");

        const action = parseAgentAction(llmResponse);

        // 判断是否完成或出错
        if (action.action === "done") {
          await updateOverlayStatus(currentWebContents, "任务完成", "success");
          sendProgress({ type: "done", step, summary: action.summary });
          setTimeout(() => cleanupOverlay(currentWebContents).catch(() => {}), 3000);
          return {
            ok: true,
            journal,
            summary: action.summary,
            warnings: collectWarnings(journal, warnings),
          };
        }
        if (action.action === "error") {
          await updateOverlayStatus(currentWebContents, "任务由于错误停止", "error");
          sendProgress({ type: "error", step, message: action.message });
          return { ok: false, journal, error: action.message, warnings: collectWarnings(journal, warnings) };
        }

        // 4. 风险评级（Locator 语义查找供 ActionGate 分析 element 属性）
        const element = resolveActionElement(snapshot, action);
        if (!element && !['scroll', 'navigate'].includes(action.action)) {
          console.warn(`[Agent] Element not found for action`, JSON.stringify(action));
        }
        let currentOrigin = "";
        try { currentOrigin = new URL(snapshot.url).origin; } catch {}
        const risk = classifyAction(action, element, { currentOrigin });

        // 5. 视觉光标移动（仅用于展示，不影响执行）
        if (element?.rect) {
          const x = element.rect.x + (element.rect.w / 2);
          const y = element.rect.y + (element.rect.h / 2);
          await moveCursorTo(currentWebContents, x, y, action.action === "click");
        }

        sendProgress({ type: "action-start", step, action, risk, element, reasoning: action.reason });

        // 6. 确认逻辑
        if (risk === "red") {
          await updateOverlayStatus(currentWebContents, "等待用户确认...", "warning");
          const confirmed = await requestConfirm({
            action, element,
            reason: getConfirmReason(action, element),
          });
          if (!confirmed) {
            sendProgress({ type: "action-skipped", step, action });
            journal.push({ step, action, result: { ok: false, error: "用户拒绝" } });
            continue;
          }
        }

        // 7. 执行（Playwright 处理所有动作，自动 scroll-into-view）
        await updateOverlayStatus(currentWebContents, `正在执行: ${action.reason || action.action}...`);
        const result = await executeAction(currentWebContents, { ...action, element });

        if (!result.ok) {
          consecutiveErrors++;
          journal.push({ step, action, result, timestamp: Date.now(), _snapshot: snapshot });
          warnings.push(`步骤 ${step} 执行失败: ${action.reason || action.action} (${result.error || "未知错误"})`);
          sendProgress({ type: "action-error", step, error: result.error });
          await updateOverlayStatus(currentWebContents, `操作失败: ${result.error}`, "error");
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            return { ok: false, journal, error: "连续失败", warnings: collectWarnings(journal, warnings) };
          }
        } else {
          consecutiveErrors = 0;
          sendProgress({ type: "action-success", step, result });

          // 8. URL 变化时重新注入 overlay
          await updateOverlayStatus(currentWebContents, "等待页面加载稳定...");
          if (result.urlChanged) {
            const page = await getPlaywrightPage(currentWebContents);
            await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
            await injectOverlay(currentWebContents);
          } else {
            const page = await getPlaywrightPage(currentWebContents);
            await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
          }

          // 9. 执行后置校验
          if (action.expectations) {
            await updateOverlayStatus(currentWebContents, "正在校验操作结果...");
            sendProgress({ type: "verify-start", step });
            const postSnapshot = await observePage(currentWebContents);
            const verification = verifyExpectations(action.expectations, snapshot, postSnapshot);
            journal.push({ step, action, result, verification, timestamp: Date.now(), _snapshot: snapshot });
            if (!verification.ok) {
              warnings.push(`步骤 ${step} 校验未通过: ${verification.reason}`);
              await updateOverlayStatus(currentWebContents, "校验失败", "warning");
              sendProgress({ type: "verify-fail", step, message: verification.reason });
            } else {
              await updateOverlayStatus(currentWebContents, "校验通过", "success");
              sendProgress({ type: "verify-success", step });
            }
          } else {
            journal.push({ step, action, result, timestamp: Date.now(), _snapshot: snapshot });
          }
        }
      } catch (err) {
        console.error(`[Agent] Step ${step} failed:`, err);
        await updateOverlayStatus(currentWebContents, `系统错误: ${err.message}`, "error");
        journal.push({ step, error: err.message });
        warnings.push(`步骤 ${step} 系统错误: ${err.message}`);
        consecutiveErrors++;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) break;
      }
    }

    await cleanupOverlay(currentWebContents);
    return { ok: true, journal, summary: "任务步数上限已达", warnings: collectWarnings(journal, warnings) };
  } catch (globalErr) {
    console.error(`[Agent] Critical failure:`, globalErr);
    return { ok: false, journal, error: globalErr.message, warnings: collectWarnings(journal, warnings) };
  }
}

/**
 * 远程执行终端模式 (V8: Brain-Hands Split)
 * 浏览器作为被动的 "Hands"，监听来自 OpenClaw "Brain" 的指令
 */
export async function runRemoteHandsMode(params, dependencies) {
  const { 
    messenger, // 抽象通讯器 (Messenger)
    getWebContentsByTabId,
    getActiveTabId,
    signal 
  } = params;
  
  if (!messenger) {
    throw new Error("Hands 需要一个有效的 Messenger 实例来接收指令。");
  }

  let currentTabId = null;
  let currentWebContents = null;

  const ensureTabAttached = async (tabId) => {
    if (currentTabId === tabId && currentWebContents && !currentWebContents.isDestroyed()) {
      return currentWebContents;
    }

    if (currentWebContents) {
      await cleanupOverlay(currentWebContents).catch(() => {});
    }

    currentTabId = tabId || getActiveTabId?.() || "";
    currentWebContents = getWebContentsByTabId(currentTabId);

    if (!currentWebContents) {
      throw new Error(`无法找到目标标签页: ${currentTabId}`);
    }

    await injectOverlay(currentWebContents);
    await updateOverlayStatus(currentWebContents, "Sabrina Hands 已连接 (远程主控模式)");
    return currentWebContents;
  };

  const handlers = {
    // 1. 观察页面
    "browser.observe": async (rpcParams) => {
      const webContents = await ensureTabAttached(rpcParams.tabId);
      await updateOverlayStatus(webContents, "正在响应远程观察请求...");
      const snapshot = await observePage(webContents);
      return { snapshot };
    },

    // 2. 执行指令
    "browser.execute": async (rpcParams) => {
      const webContents = await ensureTabAttached(rpcParams.tabId);
      const action = rpcParams.action;
      
      // A. 执行前置观察 (用于风险校验)
      const snapshot = await observePage(webContents);
      const element = resolveActionElement(snapshot, action);

      // B. 本地策略约束 (Local Constraint Gate)
      let remoteOrigin = "";
      try { remoteOrigin = new URL(snapshot.url).origin; } catch {}
      const risk = classifyAction(action, element, { currentOrigin: remoteOrigin });

      if (risk === "red") {
        await updateOverlayStatus(webContents, "拦截到高风险指令，等待本地确认...", "warning");
        const confirmed = await dependencies.requestConfirm?.({
          action,
          element,
          reason: getConfirmReason(action, element),
        });
        if (!confirmed) {
          return { result: { ok: false, error: "本地用户拒绝了该远程指令" } };
        }
      }

      // C. 视觉交互
      if (element) {
        const x = element.rect.x + (element.rect.w / 2);
        const y = element.rect.y + (element.rect.h / 2);
        await moveCursorTo(webContents, x, y, action.action === "click");
      }

      await updateOverlayStatus(webContents, `正在执行指令: ${action.reason || action.action}...`);
      const result = await executeAction(webContents, { ...action, element });
      
      // D. 等待稳定
      if (result.ok) {
        const p = await getPlaywrightPage(webContents);
        if (result.urlChanged) {
          await p.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
          await injectOverlay(webContents);
        } else {
          await p.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
        }
      }

      return { result };
    },

    // 3. 更新状态
    "browser.updateStatus": async (rpcParams) => {
      const webContents = await ensureTabAttached(rpcParams.tabId);
      await updateOverlayStatus(webContents, rpcParams.message, rpcParams.type || "info");
      if (rpcParams.action && rpcParams.element) {
        const { element, action } = rpcParams;
        const x = element.rect.x + (element.rect.w / 2);
        const y = element.rect.y + (element.rect.h / 2);
        await moveCursorTo(webContents, x, y, action.action === "click");
      }
      return { ok: true };
    },

    // 4. 指纹校验
    "browser.verify": async (rpcParams) => {
      const webContents = await ensureTabAttached(rpcParams.tabId);
      const match = await verifyElementFingerprint(webContents, rpcParams.element);
      return { match };
    }
  };

  try {
    console.log(`[Hands] Starting passive RPC listener via messenger (${messenger.identity})`);
    await messenger.listen(handlers);
  } finally {
    if (currentWebContents) {
      await cleanupOverlay(currentWebContents).catch(() => {});
    }
  }
}

/**
 * 校验元素指纹是否匹配 (Native Version)
 */
export async function verifyElementFingerprint(webContents, originalElement) {
  try {
    // V9: 不再注入 JS，直接抓取当前原生快照进行比对
    const currentSnapshot = await observePage(webContents);
    const target = currentSnapshot.interactiveElements.find(el => el.index === originalElement.index);
    
    if (!target) return false;

    const currentText = (target.text || "").trim();
    const originalText = (originalElement.text || "").trim();

    // 允许一定的包含关系（例如页面微调），但核心文本不能变
    if (currentText !== originalText && !currentText.includes(originalText) && !originalText.includes(currentText)) {
      console.warn(`[Fingerprint] Text mismatch: "${originalText}" vs "${currentText}"`);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[Fingerprint] Verification failed native check:", err);
    return false;
  }
}

async function waitForLoad(webContents, timeout) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      webContents.removeListener("did-stop-loading", onStop);
      resolve();
    };
    const onStop = finish;
    const timer = setTimeout(finish, timeout);
    webContents.once("did-stop-loading", onStop);
  });
}

function verifyExpectations(expectations, prevSnapshot, nextSnapshot) {
  if (expectations.urlChanged) {
    if (prevSnapshot.url === nextSnapshot.url) {
      return { ok: false, reason: "预期 URL 会变化，但实际未变" };
    }
  }

  if (expectations.domChanged) {
    if (
      prevSnapshot.interactiveElements.length === nextSnapshot.interactiveElements.length &&
      prevSnapshot.pageText === nextSnapshot.pageText
    ) {
      return { ok: false, reason: "预期页面内容会变化，但实际未观察到变化" };
    }
  }

  if (expectations.elementAppeared) {
    const found = nextSnapshot.interactiveElements.some(
      el => el.text.includes(expectations.elementAppeared) || 
            el.tag.includes(expectations.elementAppeared)
    );
    if (!found) {
      return { ok: false, reason: `预期元素 "${expectations.elementAppeared}" 未出现` };
    }
  }

  return { ok: true };
}

function collectWarnings(journal, warnings) {
  const issues = Array.isArray(warnings) ? [...warnings] : [];

  for (const entry of journal || []) {
    if (entry?.verification && entry.verification.ok === false) {
      issues.push(`步骤 ${entry.step} 校验未通过: ${entry.verification.reason}`);
    }
    if (entry?.result?.ok === false && entry?.result?.error) {
      issues.push(`步骤 ${entry.step} 执行失败: ${entry.result.error}`);
    }
  }

  return Array.from(new Set(issues.filter(Boolean)));
}
