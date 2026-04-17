# Sabrina Agent 模式成熟度评估

> 日期：2026-04-17
> 范围：`runtime/browser/` agent loop、`AgentTaskManager`、`ActionGate`、`BrowserAgentPromptService`、`BrowserAgentService`、相关测试与最近 25 条真实会话归档（`logs/sessions/*agent-task*.json`）

**一句话结论：骨架成熟，产品化未到位。大概处于 "可演示、可内测、不敢放量" 这一档。**

---

## 一、已经立住的部分

这几块不是 PPT，是真的跑在代码里、而且有会话归档能对上的：

### 1. Observe-Think-Act-Verify 的 loop 是标准形态

`runtime/browser/BrowserAgentService.mjs:46-199`

```
waitForPageReady
  → observePage
  → narratePage
  → buildAgentPrompt
  → runLocalAgentTurn (OpenClaw)
  → parseAgentAction
  → resolveActionElement
  → classifyAction (ActionGate)
  → moveCursorTo (overlay)
  → executeAction (Playwright)
  → verifyExpectations
  → journal.push
```

每一刀都有独立模块，不是塞在一个大函数里。

### 2. 安全层 ActionGate 是真的被调用

- 本地模式：`BrowserAgentService.mjs:131-142`
- 远程 Brain-Hands 模式：`BrowserAgentService.mjs:270-282`
- 即使 Brain 在远端 (`relay-paired`) ，红色操作依然走本地确认。
- `fill + type=password` 永远不经 LLM 填入，Executor 层硬门禁。

### 3. 中断与生命周期

- `AbortController` 每步开头检查一次（`BrowserAgentService.mjs:59-67`）。
- `tabToTask` 单标签页唯一任务约束在 `createAgentTask` 里真的生效（`AgentTaskManager.mjs:23-29`）。
- `respondToConfirm` / `cancelAgentTask` 在无任务时也不抛。

### 4. 多级 Locator 降级

`PlaywrightExecutor.buildLocatorPlans`：

```
index → placeholder → roleText → tagText → text → role → tag
```

有单测覆盖，不是只信 `data-sabrina-idx`。

### 5. Session 归档 + Thread 历史写回

- `AgentTaskManager.mjs:155-182`：journal 透传为 `skillTrace`，`screenshot` 字段预留。
- `AgentTaskManager.mjs:186-198`：`archiveSession` 存档，`logs/sessions/*.json` 里能看到从 618B（ssh 失败）到 294KB（完整跑）的真实样本。

### 6. Brain-Hands 分离模式

`runRemoteHandsMode` 提供 4 个 RPC handler：`browser.observe / execute / updateStatus / verify`。协议比想象中干净，远程大脑 ≠ 越过本地安全红线。

### 7. Overlay 视觉反馈

`PageOverlayService`：光标、状态栏、涟漪；URL 变化后重注入是幂等的。CSP 受限时降级为 warning，不影响执行。

---

## 二、"成熟度" 真相：这几块还没到位

### 1. Verification 形同虚设

`BrowserAgentService.mjs:178-186` —— 校验失败只是 `warnings.push` + 发 `verify-fail` 事件，**不触发重规划、不回退、不影响下一步**。

当前 `expectations` 更像 telemetry，不是 control。成熟 agent 在 verify 失败时应该：强制 replan / 惩罚失败元素 / 要 LLM 给出补救策略。

### 2. Task Tree 是"建议"而不是"约束"

prompt 里允许 `new_plan` 字段（`BrowserAgentPromptService.mjs:108`），但没有任何代码：

- 强制 LLM 按 plan 走
- "plan 已完成项不能回退" 这类 invariant
- plan 的 diff 作为上下文反哺下一步

### 3. ActionGate 是关键词正则

```text
/pay|purchase|buy|order|delete|remove|支付|付款|购买|下单|删除|退款|转账/i
/[¥$￥]|元|币|price|amount|total/i
```

问题：

- **误判/漏判率都不低**："完成订单" 会红，"结算" 不会。
- **图标按钮**（`<button><svg/></button>`）基本漏掉。
- **跨域 navigate** 归黄，但黄色当前直接弹确认，**没有设计文档里说的 "倒计时自动执行"**。这不是 bug，是未完成。

### 4. 失败恢复太粗糙

- `MAX_CONSECUTIVE_ERRORS = 3` 一刀切，没按错误类型分级（timeout vs 元素不存在 vs LLM 乱码）。
- `failureCount >= 2` 的元素进禁区是对的，但**只在同一个 snapshot 生命周期里**有效（`data-sabrina-idx` 每步重置），跨 step 禁区靠 prompt 带过去，记性决定效果。

### 5. LLM 输出解析太乐观

`parseAgentAction` 只做 `responseText.match(/\{[\s\S]*\}/)` 取**第一个** JSON 对象。如果 LLM 先输出一段思考再输出 JSON，可能把思考里的 `{...}` 片段当 action。归档里能看到 verify-fail 跟执行歧义的痕迹。

### 6. MAX_STEPS = 20 + 超预算不诚实

- "阅读 5 个新闻并总结" 这种任务 20 步根本不够。
- 更糟的是：步数上限到了直接返回 `{ ok: true, summary: "任务步数上限已达" }`（`BrowserAgentService.mjs:202`）。

**步数耗尽返回 ok —— 这是 bug-level 的不诚实**，和仓库自己强调的 "Execution honesty" 相矛盾。

### 7. 测试覆盖极度失衡

`BrowserAgent.test.mjs` + `BrowserAgentCapability.test.mjs`：

- ✅ 纯接口契约
- ✅ 边界退化（`isDestroyed`、Playwright 未连接）
- ✅ `buildLocatorPlans` 顺序
- ❌ `runBrowserAgent` 整条 loop 没有 mock LLM 跑完的测试
- ❌ ActionGate 没有对抗测试（给 "Complete order" 看能不能红）
- ❌ journal → thread 回写路径没测
- ❌ `acceptance/acceptance.manifest.json` 里没看到 agent scenario

对"成熟"来说这是硬缺口。

### 8. 已知但未实现的场景（设计文档自己承认）

- 文件上传 ❌
- CAPTCHA 主动交还 —— 只有 `error`，没有 human-in-loop pause
- Canvas/WebGL ❌
- iframe 基本没处理
- Shadow DOM 的兜底没看到

### 9. Experiences / 经验沉淀是半成品

prompt 里消费 `userData.experiences`（`BrowserAgentPromptService.mjs:22-24`），但**仓库里没有把 journal 成功路径回灌为 experiences 的代码**。

现在是"如果外部塞进来就用"，不是一个真的学习循环。`docs/SYSTEM_STATE.md` 自己也写着 "memory 仍需克制表达"，是一致的。

### 10. 最近一次会话自己就挂了

`logs/sessions/2026-04-16T09-09-13-987Z-agent-task-l92oqd0j.json`：

```json
{
  "userTask": "阅读5个新闻 给出总结",
  "journal": [{
    "step": 1,
    "error": "Command failed: ssh ... openclaw 'agents' 'list' --json"
  }],
  "status": "cancelled"
}
```

第一步就被 ssh backbone 噎死。Agent loop 对"底层传输抖动"没有 backoff/重试，错误直接透传给用户，生产态会很脆。

---

## 三、阶段定位

按 Claude Code / OpenAI computer-use / Browser-Use 对标线：


| 能力                       | 达成                   |
| ------------------------ | -------------------- |
| Demo 可跑                  | ✅                    |
| 单任务闭环（观察→执行→反馈）          | ✅                    |
| 安全红线（密码、支付）              | ✅ 关键词级               |
| 结构化动作 + 可复现 prompt       | ✅                    |
| 任务归档 + 线程回写              | ✅                    |
| Brain-Hands 分离执行         | ✅                    |
| 多级 Locator 降级            | ✅                    |
| 后置校验驱动重规划                | ❌                    |
| Plan-as-contract         | ❌                    |
| 失败分类 + 按类恢复              | ❌                    |
| 经验学习闭环                   | ❌                    |
| 对抗性 ActionGate 测试        | ❌                    |
| 端到端 loop 单测              | ❌                    |
| 文件 / CAPTCHA / iframe 场景 | ❌                    |
| 超步预算后诚实失败                | ❌ (返回 ok:true 是 bug) |


**结论定位：架构上已经是 agent，工程上是 alpha，产品上是 beta-前。**

---

## 四、优先改的 5 刀（按 ROI 排序）

### 1. 修 `MAX_STEPS` 到上限时返回 `ok: true`

`BrowserAgentService.mjs:202` → 改成：

```js
return {
  ok: false,
  reason: "step_budget_exhausted",
  journal,
  warnings: collectWarnings(journal, warnings),
};
```

纯 bug，半小时能改。

### 2. verify 失败触发 replan

在 prompt 里强制 LLM 先解释"上一步为什么没满足 expectations"再给 action。不用动 loop 结构，只改 `buildAgentPrompt`。

### 3. `parseAgentAction` 改成"找最后一个 balanced JSON"

- 支持多 JSON 场景取最后一个（通常是最终决策）。
- 若同一步 LLM 没给 `expectations` 就让它重试一次。
- LLM 是最便宜的修复点。

### 4. 给 agent loop 写一个端到端单测

Mock：

- fake `webContents`
- 固定 snapshot 序列
- 可脚本化的 fake `runLocalAgentTurn`

跑通 "点搜索 → 跳转 → done" 三步。
这是拦住 "改一刀炸一片" 最划算的投入。

### 5. ActionGate 加一层 LLM-intent 审查（可选开关）

对 `click` / `submit` 加一次轻量"这个动作是否会产生不可逆副作用"的二次分级，弥补关键词正则的漏判。默认 off，高敏用户 on。

---

## 五、一句话

骨架是工程师写出来的，不是 PPT 画出来的；但它离"敢让陌生用户放养跑"还差：

- 一个 **verification → replan 闭环**
- 一个 **诚实的超步语义**
- 一层 **非关键词的安全分级**

对外放 beta：先把 **第 1、2、4 条**干掉再放。
纯内测/演示：现在这套已经够用。