# Browser Agent 技术设计

> Sabrina AI Browser — 浏览器自动化 Agent 模式

**实现状态：已完成**

---

## 一、架构总览

```
用户说："帮我把这个表单填了"
          │
          ▼
┌─────────────────────────────────────────────────────┐
│                  React 渲染层                         │
│                                                      │
│  AI Sidebar                                          │
│    └─ AgentActionStream (操作流 UI)                  │
│        ├─ 实时步骤日志（每步操作卡片）                  │
│        ├─ 安全确认气泡（红色操作必须手动确认）           │
│        ├─ Task Tree 可视化（动态执行计划）              │
│        └─ 停止按钮（随时中断）                         │
│                                                      │
│  useBrowserAgentState — IPC 事件订阅、状态管理        │
│                                                      │
│  ──── preload.cjs bridge ────                        │
└──────────────────────┬──────────────────────────────┘
                       │ IPC (agent:run-browser-task / agent:progress)
┌──────────────────────▼──────────────────────────────┐
│                Electron 主进程                        │
│                                                      │
│  register-agent-ipc-handlers.mjs                    │
│    └─ BrowserAgentTaskService（任务生命周期管理）      │
│        ├─ BrowserAgentService（本地模式 agent loop） │
│        └─ runRemoteHandsMode（Brain-Hands 分离模式） │
│                                                      │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────┐ │
│  │ 观察层        │  │ 执行层          │  │ 安全层   │ │
│  │ Playwright   │  │ Playwright     │  │ Action   │ │
│  │ Observer     │  │ Executor       │  │ Gate     │ │
│  │              │  │                │  │          │ │
│  │ page.eval()  │  │ locator API    │  │ green /  │ │
│  │ 元素索引标注  │  │ 多级 Locator   │  │ yellow / │ │
│  │ 坐标提取     │  │ 自动 scroll    │  │ red 分级 │ │
│  └──────────────┘  └────────────────┘  └──────────┘ │
│                                                      │
│  PageNarratorService   PageLocatorService            │
│  PageOverlayService    BrowserAgentPromptService     │
└──────────────────────────────────────────────────────┘
                        │
                 OpenClaw（本地或远程）
            每步单 turn 调用，返回结构化 JSON 动作
```

---

## 二、Agent Loop

核心逻辑在 `runtime/browser/BrowserAgentService.mjs`，最多执行 **20 步**，连续失败 3 次自动中止。

```
for step = 1..20:
  1. waitForPageReady()          — Playwright waitForLoadState 等页面稳定
  2. observePage()               — PlaywrightObserver 提取页面快照
  3. narratePage()               — PageNarratorService 场景分类 + 关键元素评分
  4. buildAgentPrompt()          — BrowserAgentPromptService 构建 prompt
  5. runLocalAgentTurn(prompt)   — 调 OpenClaw，返回结构化 JSON 动作
  6. parseAgentAction()          — 解析 LLM 输出
  7. if action == "done"  → 成功退出
     if action == "error" → 失败退出
  8. resolveActionElement()      — PageLocatorService 定位目标元素
  9. classifyAction()            — ActionGate 风险分级
  10. moveCursorTo()             — PageOverlayService 视觉光标动画（仅展示）
  11. if risk == "red" → requestConfirm()，等用户确认；拒绝则 continue
  12. executeAction()            — PlaywrightExecutor 执行动作
  13. if result.urlChanged → page.waitForLoadState("networkidle") + injectOverlay
  14. if action.expectations → verifyExpectations()（后置校验）
  15. journal.push(step 记录)
```

每步开头检查 `signal.aborted`（AbortController），用户点停止后最多完成当前步骤即退出。

---

## 三、观察层 — PlaywrightObserver

**文件**：`runtime/browser/PlaywrightObserver.mjs`

用 `page.evaluate()` 在渲染进程内直接操作 DOM，不需要 CDP DOMSnapshot 或 AXTree。

**工作流程**：

1. 用 CSS selector 找到所有可见可交互元素（`a[href]`、`button`、`input`、`select`、`textarea`、`[role=button]` 等）
2. 过滤不可见元素（`display:none`、零尺寸、视口外 500px 以上）
3. 给每个元素写入 `data-sabrina-idx`（整数序号，本步有效，导航后重置）
4. 收集元素属性：`tag`、`type`、`text`、`value`、`placeholder`、`disabled`、`rect`（viewport-relative 坐标，Playwright 保证精确）
5. 同步收集 `scrollY`、`scrollHeight`、`pageText`（最多 5000 字符）

**快照结构**：

```javascript
{
  url, title,
  interactiveElements: [{ index, tag, type, text, value, placeholder, disabled, rect }],
  pageText,          // 去噪后的可见文字
  scrollPosition: { y, scrollHeight },
  hasMoreContent,    // (scrollY + viewportH) < (scrollHeight - 150)
  tabId,
  axNodes: [],       // Playwright 模式不需要 AXTree
}
```

**等待策略**（`waitForPageReady`）：
- 首步（`full: true`）：`page.waitForLoadState("networkidle")`
- 后续步骤：`page.waitForLoadState("domcontentloaded")`
- 超时不报错，允许继续观察

---

## 四、场景叙述层 — PageNarratorService

**文件**：`runtime/browser/PageNarratorService.mjs`

原始快照直接扔给 LLM 的问题：50+ 个元素塞满上下文，LLM 难以快速定位重点。

NarratorService 的职责是把快照压缩为"叙述对象"再交给 prompt 构建器：

- **场景分类**（`classifyScene`）：根据 URL、标题、页面结构，识别出 `login`、`register`、`search_results`、`checkout`、`form`、`generic` 等场景类型，传递给 LLM 作为上下文提示
- **关键元素评分**（`scoreElement`）：按标签类型、文本质量、高价值关键词（提交/搜索/登录）、失败历史对每个元素打分，取前 12 个作为"关键元素"
- **快照 Diff**（`diffSnapshots`）：与上一步快照比较，生成 `url_changed`、`title_changed`、`elements_delta`、`scroll_moved`，让 LLM 感知上一步操作是否生效

格式化后输出（`formatNarration`）的 prompt 段落包含场景类型、关键元素列表、其余元素备查、页面文字摘要、diff 说明。

---

## 五、执行层 — PlaywrightExecutor

**文件**：`runtime/browser/PlaywrightExecutor.mjs`

所有动作通过 Playwright Locator API 执行，框架负责 scroll-into-view、元素可见性等待、超时。

**5 个原子操作**：

| 操作 | 实现 | 特殊处理 |
|------|------|---------|
| `click` | `locator.click()` | 多级 Locator 降级匹配 |
| `fill` | `locator.fill(text)` | Playwright 先清空再输入，兼容 React/Vue；`__PASSWORD__` 时直接返回 `isPasswordEntry: true` 不填写；支持 `submit: true` 触发 Enter |
| `select` | `locator.selectOption(value)` | — |
| `scroll` | `page.evaluate(window.scrollBy)` | 每次滚动 `0.8 * viewportHeight` |
| `navigate` | `page.goto(url, {waitUntil: "domcontentloaded"})` | 超时 30s |

**多级 Locator 降级**（`withResolvedLocator`）：

元素 DOM 的 `data-sabrina-idx` 可能因页面动态更新失效，Executor 按以下优先级依次尝试：

1. `action.target`（语义目标，`{ role, text, type }`）→ `page.getByRole()` / `page.getByText()`
2. `action.index` → `[data-sabrina-idx="N"]`
3. 元素指纹（placeholder → role+text → tag+text → text → role → type → tag）

首个 locator 尝试超时 4000ms，后续每个 1500ms。失败原因若为"元素找不到"则继续降级，其他错误直接抛出。

---

## 六、定位层 — PageLocatorService

**文件**：`runtime/browser/PageLocatorService.mjs`

用于 `BrowserAgentService` 在执行前定位目标元素以供 ActionGate 分析属性（ActionGate 需要知道元素的 `type`、`text` 等才能分级）。

`resolveActionElement(snapshot, action)` 的逻辑：
1. 优先用 `action.target`（语义目标）在快照中按评分匹配
2. 降级用 `action.index` 查找
3. index 找不到时用 `action.targetText` 做文字兜底（防 index 漂移）

评分函数 `matchScore` 综合文本完全匹配（+10）、文本包含（+5）、role 语义别名（+3~8）、type 匹配（+4）、hint 模糊匹配（+2），并对失败过的元素做惩罚（每次 -5 分）。

---

## 七、安全层 — ActionGate

**文件**：`runtime/browser/ActionGate.mjs`

对每个 LLM 产出的动作进行三级风险分类，在 `classifyAction(action, element, context)` 中完成：

### 红色（必须手动确认）

- `fill` + `element.type === "password"`：密码字段（Agent 不填写，必须交回用户）
- `click` + 元素文字匹配 `/pay|purchase|buy|order|delete|remove|支付|付款|购买|下单|删除|退款|转账/i`
- `click` + 元素文字包含金额符号 `/[¥$￥]|元|币|price|amount|total/i`

### 黄色（当前实现直接显示确认，未来可做倒计时自动执行）

- `fill` + 敏感字段（email/phone/tel/mobile/address/身份/证件/手机/邮箱/地址/name/姓名）
- `click` + 提交类按钮（submit/confirm/ok/next/register/login/sign/提交/确认/下一步/注册/登录）
- `navigate` + 跨域（`targetOrigin !== currentOrigin`）

### 绿色（直接执行）

其余所有操作：普通文字输入、链接点击、滚动、页面内导航等。

**确认文案**（`getConfirmReason`）：密码字段提示"请手动操作"，点击类描述目标按钮文字，导航类展示目标 URL。

---

## 八、页面视觉层 — PageOverlayService

**文件**：`runtime/browser/PageOverlayService.mjs`

通过 `webContents.executeJavaScript()` 向被操作页面注入一个 `position: fixed; z-index: 2147483647; pointer-events: none` 的全屏透明层，不干扰页面交互。

三个视觉元素：
- **状态栏**：底部居中浮层（磨砂玻璃样式），实时显示当前步骤状态文字和颜色指示点（红色=运行中，绿色=成功，黄色=等待，红色=错误）
- **光标**：粉红色圆点，在 Agent 执行操作前平滑移动到目标元素中心（CSS transition）
- **点击涟漪**：`click` 操作时在光标位置生成扩散动画圆环

**导出函数**：

```javascript
injectOverlay(webContents)                     // 注入覆盖层（幂等）
updateOverlayStatus(webContents, text, type)   // 更新状态栏文字（info/success/warning/error）
moveCursorTo(webContents, x, y, isClick)       // 移动光标，isClick=true 时触发涟漪
cleanupOverlay(webContents)                    // 淡出并移除覆盖层（延时 450ms 后 remove）
```

URL 变化后重新注入（`injectOverlay` 幂等，已有则只恢复可见度）。Overlay 注入失败（如 CSP 限制）只打 warning，不影响执行。

---

## 九、Prompt 构建 — BrowserAgentPromptService

**文件**：`runtime/browser/BrowserAgentPromptService.mjs`

`buildAgentPrompt(task, snapshot, journal, userData, narration)` 组装最终发给 LLM 的 prompt，包含：

- **禁区警告**：`failureCount >= 2` 的元素列入禁止区域，LLM 不得再次尝试
- **历史成功经验**：`userData.experiences` 中按网站类型记录的成功技巧
- **用户数据**：提供给 Agent 的姓名/邮箱等结构化数据
- **页面状态**：优先用 NarratorService 格式化（场景分类 + 关键元素 + diff），降级用原始元素列表
- **意图约束**：来自聊天历史的用户偏好（`userData.constraints`）
- **Task Tree**：当前执行计划，LLM 可以在响应中包含 `new_plan` 字段动态更新
- **操作历史**：最近 5 步的动作和结果摘要

**输出动作格式**（LLM 只输出 JSON，不加解释）：

```json
{"action": "click",    "index": 3,  "reason": "...", "expectations": {"urlChanged": true}}
{"action": "fill",     "index": 5,  "text": "张三", "reason": "...", "expectations": {"domChanged": true}}
{"action": "fill",     "index": 5,  "text": "贝壳新闻", "submit": true, "reason": "...", "expectations": {"urlChanged": true}}
{"action": "select",   "index": 7,  "value": "北京", "reason": "..."}
{"action": "scroll",   "direction": "down", "reason": "..."}
{"action": "navigate", "url": "https://...", "reason": "..."}
{"action": "done",     "summary": "已完成..."}
{"action": "error",    "message": "遇到验证码，无法继续"}
```

`expectations` 字段用于后置校验：`urlChanged`（URL 应变化）、`domChanged`（DOM 内容应变化）、`elementAppeared`（某元素应出现）。

`parseAgentAction(llmResponse)` 从 LLM 原始字符串中用正则提取第一个 JSON 对象。

---

## 十、任务管理 — BrowserAgentTaskService

**文件**：`runtime/turns/BrowserAgentTaskService.mjs`

### 任务状态机

```
idle → running → completed
              ↘ error
              ↘ cancelled  ← cancelAgentTask() 随时可触发
  running ↔ paused        ← 红色操作触发，respondToConfirm() 恢复
```

### 核心数据结构

```javascript
{
  taskId,      // 唯一标识
  sessionId,   // 传给 OpenClaw 实现跨步骤持久记忆
  tabId,
  threadId,    // 关联的聊天 Thread，完成后写入消息历史
  status,      // idle | running | paused | completed | error | cancelled
  userTask,    // 用户原始指令
  userData,    // 用户提供的数据（姓名/邮箱等）
  journal,     // 操作日志
  warnings,    // 非致命警告（步骤失败但任务继续）
  currentStep,
  abortController,    // cancel 时 abort()
  pendingConfirm,     // 等待确认的操作描述
  resolveConfirm,     // Promise resolver，respondToConfirm 调用
  summary, error,
  createdAt, updatedAt,
}
```

### 运行模式选择

`startAgentTask()` 根据 OpenClaw 传输上下文判断使用哪种运行模式：

- **本地模式**（默认）：调用 `runBrowserAgent()`，所有逻辑在本机 Electron 主进程中运行，OpenClaw 作为 LLM 推理引擎
- **Brain-Hands 分离模式**（`relay-paired` driver）：见第十一节

### 任务结束后处理

任务完成或失败后：
1. 若有 `threadId`，将结果（包含 journal 的 `skillTrace`）写入聊天 Thread 历史
2. 调用 `archiveSession()` 存档（用于长期优化）
3. 触发 `onTaskEnd` 回调，通知渲染层

**单标签页限制**：同一 `tabId` 只能有一个 `running` 或 `paused` 状态的任务，新建时自动检查。

---

## 十一、Brain-Hands 分离模式

当 OpenClaw 配置了远程 relay 配对时（`driver === "relay-paired"`），切换到 Brain-Hands 分离架构：

```
OpenClaw（远程大脑）                 Sabrina 本地（双手）
        │                                    │
        │ browser.observe(tabId)             │
        │ ─────────────────────────────────▶ │ observePage()
        │ ◀──────────── { snapshot }──────── │
        │                                    │
        │ browser.execute(tabId, action)     │
        │ ─────────────────────────────────▶ │ ActionGate（本地约束）
        │                                    │ executeAction()
        │ ◀──────────── { result } ───────── │
        │                                    │
        │ browser.updateStatus(message)      │
        │ ─────────────────────────────────▶ │ updateOverlayStatus()
        │                                    │
        │ browser.verify(element)            │
        │ ─────────────────────────────────▶ │ verifyElementFingerprint()
```

关键设计：**本地 ActionGate 仍然生效**。即使 Brain 在远程，`browser.execute` 处理器会先做 `classifyAction()`，红色操作依然弹本地确认，用户的安全控制权不因远程模式而削弱。

两个并发 Promise：
- `runRemoteHandsMode()`：被动 RPC 监听器，等待 Brain 发来指令
- `runRemoteBrainLoop()`（OpenClaw 侧）：Brain 主循环，驱动整个任务流程

任务结束时关闭 Messenger，AbortController 取消 Hands 监听。

---

## 十二、IPC 层

**文件**：`host/electron/register-agent-ipc-handlers.mjs`

### IPC 通道

| 通道 | 方向 | 说明 |
|------|------|------|
| `agent:run-browser-task` | 渲染→主 | 创建并异步启动任务，立即返回 `{ ok, taskId }` |
| `agent:progress` | 主→渲染 | 每步进度推送（observe/think/action-start/action-success 等） |
| `agent:request-confirm` | 主→渲染 | 红色操作请求确认 |
| `agent:confirm-response` | 渲染→主 | 用户的确认/拒绝响应 |
| `agent:completed` | 主→渲染 | 任务最终结束（completed/error/cancelled） |
| `agent:stop` | 渲染→主 | 用户中断任务 |
| `agent:get-task` | 渲染→主 | 查询任务状态（脱敏返回） |

任务启动后立即返回 `taskId`，不阻塞 IPC，进度通过 `event.sender.send()` 流式推送。渲染层销毁前检查 `isDestroyed()` 防止向已关闭窗口发送事件。

---

## 十三、UI 层

### AgentActionStream 组件

**文件**：`src/components/agent-action-stream.tsx`

嵌在 AI Sidebar 聊天流中，按需渲染（`journal.length === 0 && status === "idle"` 时不渲染）。

**视觉区块**（从上到下）：

1. **Live Banner**（仅 running 时）：红色脉冲图标 + "Sabrina Agent 运行中" + 已执行步数 + shimmer 进度条
2. **Task Tree**（running 时，有 plan 时）：任务树可视化，done/active/pending 三态
3. **停止按钮**（running 时）：右对齐小按钮，点击触发 `onStop`
4. **Thinking Card**（当前最新事件为 think 时）：脑图标 + 三点跳动动画
5. **步骤日志**（新到旧排序，最多显示 380px 高度，可滚动）：每步 StepCard
6. **确认卡片**（`pendingConfirm` 不为空时）：红色卡片，显示风险原因，"确认执行"和"跳过"两个按钮
7. **完成/错误状态**：绿色完成横幅或红色错误横幅

**StepCard** 展示内容：
- 步骤编号 + 类型标签（观察页面/分析决策/执行操作/操作成功/校验通过 等）
- 若有截图（Base64）则展示缩略图
- 风险等级徽章（仅 red 显示"⚠ 高风险"）
- Agent 的 reasoning（斜体引用）
- 动作描述
- 错误详情或校验失败原因

### useBrowserAgentState hook

**文件**：`src/application/use-browser-agent-state.ts`

管理 Agent 运行期间的所有前端状态：`status`、`journal`、`pendingConfirm`、`summary`、`warnings`、`taskTree`。

三路 IPC 订阅：
- `onProgress`：追加 journal 条目，更新 taskTree
- `onRequestConfirm`：切换 status 为 `paused`，设置 `pendingConfirm`
- `onCompleted`：更新最终状态，清空 `activeTaskId`

对外暴露三个操作：`runTask(task, userData, threadId)`、`stopTask()`、`respondConfirm(confirmed)`。

---

## 十四、交互设计原则

### 操作模式：DOM 编号而非截图坐标

使用 `data-sabrina-idx` 对元素编号，LLM 引用编号而非像素坐标。优点：
- token 消耗小（不需要发截图）
- 精确（坐标是 Playwright 实时计算的 viewport-relative，不漂移）
- 可降级（多级 Locator 兜底）

### LLM 通信：每步单 turn 无状态调用

每个 agent loop 步骤是独立的 OpenClaw 调用，journal 作为历史上下文传入。好处：
- 无状态漂移（每步观察最新页面）
- 易调试（每步 prompt 独立可复现）
- `sessionId` 传入 OpenClaw 可实现跨步记忆（可选）

### 密码字段：永远不由 Agent 填写

`fill` 目标为 `type=password` 时，Executor 返回 `isPasswordEntry: true`，ActionGate 将其标为红色，弹出用户手动输入提示，Agent 不接触密码内容。

### 停止与回滚

- **随时停止**：`AbortController.abort()` 在下一步迭代开头生效，当前步骤执行完毕后退出
- **不支持回滚**：已填写的字段不自动清空（不可靠且成本高）。Agent 停止后告知用户自行修改
- **已完成的操作不因停止而撤销**

### 适用场景与限制

| 场景 | 说明 |
|------|------|
| 表单填写 | Agent 核心能力，逐字段 fill |
| 登录 | 账号填写后密码必须用户手动输入 |
| 搜索与导航 | fill + submit，或 navigate |
| 多步导航 | click 系列操作，最多 20 步 |
| 验证码 | 无法解决，输出 error 交回用户 |
| 支付操作 | ActionGate 红色，必须用户确认 |
| 文件上传 | 暂未实现（需要系统文件选择器） |
| Canvas/WebGL 应用 | DOM 观察层无法工作 |

---

## 十五、文件清单

| 文件 | 职责 |
|------|------|
| `runtime/browser/BrowserAgentService.mjs` | Agent loop 核心；Brain-Hands 分离模式的 Hands 端 |
| `runtime/browser/PlaywrightObserver.mjs` | 观察层：DOM 快照提取，Playwright page.evaluate |
| `runtime/browser/PlaywrightExecutor.mjs` | 执行层：5 个原子操作，多级 Locator 降级 |
| `runtime/browser/ActionGate.mjs` | 安全层：green/yellow/red 三级风险分类 |
| `runtime/browser/PageNarratorService.mjs` | 叙述层：场景分类、元素评分、快照 Diff |
| `runtime/browser/PageLocatorService.mjs` | 定位层：语义目标匹配，防 index 漂移 |
| `runtime/browser/PageOverlayService.mjs` | 视觉层：页面内状态栏、光标动画、涟漪效果 |
| `runtime/browser/BrowserAgentPromptService.mjs` | Prompt 构建；LLM 响应解析 |
| `runtime/turns/BrowserAgentTaskService.mjs` | 任务生命周期：创建/启动/确认/取消/存档；补 turn receipt / journal |
| `host/electron/register-agent-ipc-handlers.mjs` | IPC 注册：7 个通道 |
| `src/components/agent-action-stream.tsx` | 操作流 UI 组件 |
| `src/application/use-browser-agent-state.ts` | Agent 状态 hook，IPC 事件订阅 |

---

## 十六、关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 观察技术 | `page.evaluate()` 取代 CDP DOMSnapshot + AXTree | Playwright 保证坐标精确，代码简单，不需要坐标映射 |
| 执行技术 | Playwright Locator API | 内置 scroll-into-view、等待、超时；多级降级比手写 JS 健壮 |
| LLM 交互 | 每步单 turn + 纯文本 JSON | 复用 runLocalAgentTurn，不改 OpenClaw 核心；prompt 可重现 |
| 安全机制 | 三级分级（green/yellow/red） | 全部确认烦躁；全自动风险高；分级平衡体验与安全 |
| 密码处理 | 不填，交回用户 | 安全红线，无论本地还是远程模式一律执行 |
| 状态管理 | journal 作为每步上下文 | 无状态漂移；每步从最新页面观察出发 |
| 操作粒度 | 原子操作（单字段 fill、单元素 click）| LLM 组合原子操作，比高级语义更灵活通用 |
| 远程模式安全 | Brain-Hands 分离但 ActionGate 始终本地执行 | 远程大脑无法绕过本地用户的安全确认 |
