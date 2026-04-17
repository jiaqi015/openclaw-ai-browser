import { invokeSabrinaRelayRpc } from "./relay/SabrinaRelayRpcService.mjs";
import { runLocalAgentTurn } from "./OpenClawExecutionService.mjs";
import { buildAgentPrompt, parseAgentAction } from "../browser/BrowserAgentPromptService.mjs";
import { classifyAction, getConfirmReason } from "../browser/ActionGate.mjs";
import { mixOpenClawContext, extractIntentConstraints } from "./OpenClawContextMixer.mjs";
import { experienceService } from "./SabrinaExperienceService.mjs";
import { narratePage } from "../browser/PageNarratorService.mjs";
import { resolveActionElement } from "../browser/PageLocatorService.mjs";

const MAX_STEPS = 25;

/**
 * OpenClaw 远程大脑服务 (V8: Brain-Hands Split)
 * 驱动远程执行终端 (Hands) 完成任务
 */
export async function runRemoteBrainLoop(params, dependencies) {
  const {
    messenger, // 抽象通讯器 (Messenger)
    task,
    userData,
    sendProgress,
    requestConfirm,
    signal,
    tabId
  } = params;

  if (!messenger) {
    throw new Error("Brain 需要一个有效的 Messenger 实例来指挥 Hands。");
  }

  let prevSnapshot = null; // V9: 用于自省比对
  const failureCounts = new Map(); // V9: 记录顽固失败的 NodeID
  let currentTabId = tabId || "";
  const journal = [];

  // V9: 初始化任务树与意图约束
  const taskTree = {
    goal: task,
    plan: [], // Array of { id, title, status: 'pending'|'active'|'done'|'failed' }
    currentId: null
  };

  const hands = {
    observe: (tabId) => messenger.call("browser.observe", { tabId }),
    execute: (tabId, action) => messenger.call("browser.execute", { tabId, action }),
    updateStatus: (tabId, message, type = "info", progress = {}) => 
      messenger.call("browser.updateStatus", { tabId, message, type, ...progress }),
    verify: (tabId, element) => messenger.call("browser.verify", { tabId, element })
  };

  try {
    for (let step = 1; step <= MAX_STEPS; step++) {
      if (signal?.aborted) break;

      // 1. 获取增强上下文 (Context Mixing)
      const mixedContext = await mixOpenClawContext({
        threadId: params.threadId,
        currentTabId,
        task,
        journal
      });
      const constraints = extractIntentConstraints(mixedContext);

      // 2. 发起观察 (带重试机制)
      await hands.updateStatus(currentTabId, "大脑正在响应页面状态并同步记忆...");
      sendProgress?.({ type: "observe", step, taskTree: taskTree.plan });
      
      let snapshot = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await hands.observe(currentTabId);
          snapshot = res?.snapshot || res?.result?.snapshot || null;
          if (snapshot) break;
          console.warn(`[Brain] Observe returned empty snapshot (attempt ${attempt + 1})`);
        } catch (err) {
          console.warn(`[Brain] Observe failed (attempt ${attempt + 1}):`, err);
        }
        if (attempt < 2) await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
      }

      if (!snapshot) {
        throw new Error("无法观察当前页面状态，请检查网络或标签页是否可用。");
      }
      currentTabId = snapshot.tabId || currentTabId;

      // 3. 思考 (带任务规划逻辑)
      await hands.updateStatus(currentTabId, "大脑正在制定/调整执行计划...");
      sendProgress?.({ type: "think", step, taskTree: taskTree.plan });
      
      // 在快照中标记失败计数，供 Prompt 使用
      snapshot.interactiveElements?.forEach(e => {
        e.failureCount = failureCounts.get(e.backendNodeId) || 0;
      });

      // 获取长期经验
      let domain = "";
      try { domain = snapshot.url ? new URL(snapshot.url).hostname : ""; } catch {}
      const experiences = await experienceService.getExperience(domain);

      // Narrator：将快照压缩为结构化场景描述（含 diff）
      const narration = narratePage(snapshot, prevSnapshot);

      const prompt = buildAgentPrompt(task, snapshot, journal, {
        ...userData,
        constraints,
        taskTree: taskTree.plan,
        history: mixedContext.history,
        experiences,
      }, narration);

      const llmRaw = await runLocalAgentTurn({ message: prompt }, dependencies);
      // runLocalAgentTurn 返回 { agentId, text, sessionId, ... }，取 .text 字段
      const llmResponse = (typeof llmRaw === 'object' && llmRaw !== null)
        ? (llmRaw.text || llmRaw.content || llmRaw.message || "")
        : String(llmRaw ?? "");

      const action = parseAgentAction(llmResponse);

      // 4. 自省与计划更新 (Reflection & Planning)
      if (action.new_plan && Array.isArray(action.new_plan)) {
        taskTree.plan = action.new_plan;
        await hands.updateStatus(currentTabId, `任务拆解: ${taskTree.plan.map(p => p.title).join(' -> ')}`);
      }

      // 5. 任务成功收尾：沉淀经验
      if (action.action === "done") {
        await hands.updateStatus(currentTabId, "任务已由大脑确认完成", "success");
        
        // 沉淀经验：总结当前域的成功技巧
        let domain = "";
        try { domain = snapshot.url ? new URL(snapshot.url).hostname : ""; } catch {};
        if (domain) {
          await experienceService.recordSuccess(domain, "general", action.summary || "成功完成了操作");
        }

        sendProgress?.({ type: "done", step, summary: action.summary });
        return { ok: true, journal, summary: action.summary };
      }

      if (action.action === "error") {
        await hands.updateStatus(currentTabId, `任务失败: ${action.message}`, "error");
        sendProgress?.({ type: "error", step, message: action.message });
        return { ok: false, journal, error: action.message };
      }

      // 3. 安全与确认（用 Locator 替换旧的 index 查找）
      const element = resolveActionElement(snapshot, action);
      let brainOrigin = "";
      try { brainOrigin = snapshot.url ? new URL(snapshot.url).origin : ""; } catch {}
      const risk = classifyAction(action, element, { currentOrigin: brainOrigin });

      if (risk === "red" && requestConfirm) {
        await hands.updateStatus(currentTabId, "等待人类确认高风险操作...", "warning");
        const confirmed = await requestConfirm({
          action,
          element,
          reason: getConfirmReason(action, element),
        });
        if (!confirmed) {
          journal.push({ step, action, result: { ok: false, error: "用户拒绝" } });
          continue;
        }
      }

      // 4. 下发执行指令
      await hands.updateStatus(currentTabId, `大脑下发指令: ${action.reason || action.action}`, "info", { action, element });
      sendProgress?.({ type: "action-start", step, action, risk, element, reasoning: action.reason, taskTree: taskTree.plan });

      const execRes = await hands.execute(currentTabId, action);
      // browser.execute handler 返回 { result: {ok, ...} }
      const execResult = execRes?.result ?? execRes ?? { ok: false, error: '未收到执行结果' };

      journal.push({ step, action, result: execResult, timestamp: Date.now() });
      prevSnapshot = snapshot; // 存储当前快照作为下一次的"上一次状态"

      if (execResult.ok) {
        sendProgress?.({ type: "action-success", step, result: execResult, taskTree: taskTree.plan });
      } else {
        sendProgress?.({ type: "action-error", step, error: execResult.error, taskTree: taskTree.plan });
        // 记录失败
        const nodeId = element?.backendNodeId;
        if (nodeId) {
          const count = (failureCounts.get(nodeId) || 0) + 1;
          failureCounts.set(nodeId, count);
        }
      }

      // 5. 短暂休眠，等待环境稳定
      await new Promise(r => setTimeout(r, 1000));
    }

    return { ok: true, journal, summary: "达到最大步数限制" };
  } catch (error) {
    console.error("[Brain] Loop crashed:", error);
    return { ok: false, journal, error: error.message };
  }
}
