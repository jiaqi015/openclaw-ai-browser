# Browser Agent 技术设计

> Sabrina AI Browser — 浏览器自动化 Agent 模式

## 一、架构总览

```
用户说："帮我把这个表单填了"
          │
          ▼
┌─────────────────────────────────────────────────────┐
│                  React 渲染器                        │
│                                                      │
│  AI Sidebar (已有)                                   │
│    └─ Agent Mode UI                                  │
│        ├─ 动作流（实时显示每步操作）                    │
│        ├─ 安全确认气泡（红色操作弹确认）                │
│        └─ 操作回放（历史记录）                         │
│                                                      │
│  ──── preload.cjs bridge (扩展) ────                 │
└──────────────────────┬──────────────────────────────┘
                       │ IPC
┌──────────────────────▼──────────────────────────────┐
│                Electron 主进程                        │
│                                                      │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ 观察层      │  │ 操作层        │  │ 安全层       │ │
│  │ PageAgent   │  │ PageAction   │  │ ActionGate   │ │
│  │ Observer    │  │ Executor     │  │              │ │
│  │            │  │              │  │ green/yellow │ │
│  │ 标注元素    │  │ click/fill/  │  │ /red 分级    │ │
│  │ 提取状态    │  │ select/scroll│  │              │ │
│  │ 截屏       │  │ /navigate    │  │ 红色→等用户   │ │
│  └────────────┘  └──────────────┘  └──────────────┘ │
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │          BrowserAgentService (调度器)             ││
│  │                                                  ││
│  │  while (!done && step < maxSteps) {              ││
│  │    snapshot = observe(webContents)                ││
│  │    action = await thinkViaOpenClaw(snapshot)      ││
│  │    gate = classifyRisk(action)                   ││
│  │    if (gate === 'red') await waitUserConfirm()   ││
│  │    result = execute(webContents, action)          ││
│  │    journal.record(step, snapshot, action, result) ││
│  │  }                                               ││
│  └──────────────────────────────────────────────────┘│
│                       │                              │
│  ─── runLocalAgentTurn / runAgentTurn ───            │
└───────────────────────┬─────────────────────────────┘
                        │
                 OpenClaw Agent
            (思考 + 返回结构化动作)
```

---

## 二、浏览器端要做什么

### 2.1 观察层 — `PageAgentObserver`

> 新文件：`runtime/browser/PageAgentObserver.mjs`

职责：给当前页面拍一张"可交互快照"，供 LLM 决策。

```javascript
/**
 * 注入 JS 到 webContents，标注所有可交互元素，返回结构化列表。
 * 这是整个 Agent 的"眼睛"。
 *
 * @returns {AgentPageSnapshot}
 */
export async function observePage(webContents) → {
  url: string,
  title: string,
  scrollPosition: { x, y, scrollHeight, viewportHeight },
  interactiveElements: [
    {
      index: number,        // 从 1 开始的编号，LLM 用这个引用
      tag: string,          // "button" | "input" | "a" | "select" | ...
      role: string,         // ARIA role
      type: string,         // input type: "text" | "email" | "password" | "submit" | ...
      text: string,         // 可见文本（按钮文字、链接文字、label 文字）
      placeholder: string,  // input placeholder
      value: string,        // 当前值（密码字段返回 "***"）
      checked: boolean,     // checkbox/radio
      disabled: boolean,
      rect: { x, y, w, h },// 屏幕坐标
      options: string[],    // select 的 option 列表
    }
  ],
  // 页面上的关键文本（表单标题、错误提示、成功消息）
  pageText: string,         // 去噪后的可见文本，截断到 2000 字符
  formGroups: [             // 识别出的表单分组
    {
      formIndex: number,
      action: string,       // form action URL
      method: string,       // GET/POST
      fields: number[],     // 关联的 interactiveElements index
    }
  ],
}
```

**实现方式**：`webContents.executeJavaScript(IIFE)`，复用已有的 `PageContextService` 注入模式。

**关键设计决策**：
- 密码字段的 `value` 一律返回 `"***"`，不传给 LLM
- `text` 字段优先取 `aria-label` > `label[for]` > `placeholder` > `innerText`
- 限制返回最多 80 个元素（按 DOM 顺序，跳过不可见的）
- 每个元素的 `text` 截断到 60 字符

### 2.2 操作层 — `PageActionExecutor`

> 新文件：`runtime/browser/PageActionExecutor.mjs`

5 个原子操作，全部通过 `webContents.executeJavaScript()` 实现：

| 原语 | 签名 | 实现要点 |
|------|------|---------|
| `click` | `click(webContents, index)` | 找到元素 → `el.scrollIntoView()` → `el.click()` → 等 100ms |
| `fill` | `fill(webContents, index, text)` | `el.focus()` → 清空 → 逐字符 dispatchEvent(input) → 触发 change |
| `select` | `select(webContents, index, value)` | 设置 `el.value` → dispatch change 事件 |
| `scroll` | `scroll(webContents, direction, amount?)` | `window.scrollBy(0, ±viewportHeight * 0.8)` |
| `navigate` | `navigate(webContents, url)` | `webContents.loadURL(url)` + 等 did-stop-loading |

```javascript
// 每个操作返回统一格式
type ActionResult = {
  ok: boolean,
  elementText?: string,  // 被操作元素的文字（给 LLM 确认用）
  error?: string,
  // 操作后的页面变化信号
  urlChanged: boolean,
  newUrl?: string,
}
```

**`fill` 的特殊处理**：
- React/Vue 等框架劫持了 `value` setter，直接赋值不会触发状态更新
- 需要用 `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, text)` + `el.dispatchEvent(new Event('input', { bubbles: true }))`

**`navigate` 的特殊处理**：
- 需要等 `did-stop-loading` 事件，超时 15s 后继续
- 返回新 URL 供 LLM 确认导航是否成功

### 2.3 安全层 — `ActionGate`

> 新文件：`runtime/browser/ActionGate.mjs`

```javascript
/**
 * 对每个 LLM 产出的动作进行风险分级。
 * 返回 "green" | "yellow" | "red"
 */
export function classifyAction(action, element) → RiskLevel

// 分级规则：
const RULES = {
  green: [
    // 无副作用的观察类操作
    'scroll',
    // 点击普通链接（非 submit、非 delete）
    { action: 'click', when: el => el.tag === 'a' && !isDestructiveText(el.text) },
    // 填写非敏感字段
    { action: 'fill', when: el => !isSensitiveField(el) },
  ],

  yellow: [
    // 填写非密码但敏感的字段（邮箱、手机号、地址）
    { action: 'fill', when: el => isSensitiveField(el) && el.type !== 'password' },
    // 点击提交类按钮（非支付、非删除）
    { action: 'click', when: el => isSubmitLike(el) && !isPaymentOrDelete(el) },
    // 导航到外部域名
    { action: 'navigate', when: (_, ctx) => isExternalDomain(ctx) },
  ],

  red: [
    // 密码输入
    { action: 'fill', when: el => el.type === 'password' },
    // 支付 / 删除 / 发送类按钮
    { action: 'click', when: el => isPaymentOrDelete(el) || isSendMessage(el) },
    // 任何涉及金额确认的操作
    { action: 'click', when: el => hasMoneyContext(el) },
  ],
}
```

**辅助判断函数**：

```javascript
function isSensitiveField(el) {
  const hints = /email|phone|tel|mobile|address|身份|证件|手机|邮箱|地址/i;
  return hints.test(el.type + el.placeholder + el.text);
}

function isPaymentOrDelete(el) {
  const hints = /pay|purchase|buy|order|delete|remove|支付|付款|购买|下单|删除/i;
  return hints.test(el.text);
}

function isSendMessage(el) {
  const hints = /send|发送|提交评论|post|publish|发布/i;
  return hints.test(el.text);
}
```

### 2.4 调度器 — `BrowserAgentService`

> 新文件：`runtime/browser/BrowserAgentService.mjs`

核心 agent loop，编排观察→思考→执行的循环：

```javascript
/**
 * @param {object} params
 * @param {string} params.tabId       — 要操作的标签页
 * @param {string} params.task        — 用户的自然语言任务描述
 * @param {object} params.userData    — 用户提供的数据（姓名、邮箱等，可选）
 * @param {function} params.sendProgress — 进度回调
 * @param {function} params.requestConfirm — 请求用户确认（红色操作）
 */
export async function runBrowserAgent(params, dependencies) {
  const { tabId, task, userData, sendProgress, requestConfirm } = params;
  const { runLocalAgentTurn } = dependencies;
  const webContents = getWebContentsByTabId(tabId);

  const journal = [];  // 操作日志
  const MAX_STEPS = 20;
  const MAX_CONSECUTIVE_ERRORS = 3;
  let consecutiveErrors = 0;

  for (let step = 0; step < MAX_STEPS; step++) {
    // 1. 观察
    const snapshot = await observePage(webContents);
    sendProgress({ type: 'observe', step, snapshot: summarize(snapshot) });

    // 2. 思考（调 OpenClaw）
    const prompt = buildAgentPrompt(task, snapshot, journal, userData);
    const llmResponse = await runLocalAgentTurn({ message: prompt });
    const action = parseAgentAction(llmResponse);

    // 3. 判断是否完成
    if (action.type === 'done') {
      sendProgress({ type: 'done', step, summary: action.summary });
      return { ok: true, journal, summary: action.summary };
    }

    if (action.type === 'error') {
      sendProgress({ type: 'error', step, message: action.message });
      return { ok: false, journal, error: action.message };
    }

    // 4. 安全分级
    const element = snapshot.interactiveElements.find(e => e.index === action.index);
    const risk = classifyAction(action, element);
    sendProgress({ type: 'action', step, action, risk, element });

    if (risk === 'red') {
      const confirmed = await requestConfirm({
        action,
        element,
        reason: getConfirmReason(action, element),
      });
      if (!confirmed) {
        sendProgress({ type: 'skipped', step, action });
        journal.push({ step, action, result: 'user_denied' });
        continue;
      }
    }

    // 5. 执行
    const result = await executeAction(webContents, action);
    journal.push({ step, action, result, timestamp: Date.now() });

    if (!result.ok) {
      consecutiveErrors++;
      sendProgress({ type: 'action-error', step, error: result.error });
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        return { ok: false, journal, error: '连续操作失败，已停止' };
      }
    } else {
      consecutiveErrors = 0;
    }

    // 6. 等页面稳定（如果 URL 变了，等加载完成）
    if (result.urlChanged) {
      await waitForLoad(webContents, 10_000);
    } else {
      await wait(300); // DOM 更新时间
    }
  }

  return { ok: false, journal, error: '超过最大步数限制' };
}
```

### 2.5 IPC 注册

> 修改：`host/electron/register-browser-ipc-handlers.mjs`（或新增 `register-agent-ipc-handlers.mjs`）

```javascript
// 启动 agent 任务（长时间运行，流式返回进度）
ipcMain.handle("agent:run-browser-task", async (e, payload) => {
  const sendProgress = (data) => {
    if (!e.sender.isDestroyed()) {
      e.sender.send("agent:progress", data);
    }
  };

  const requestConfirm = (data) => {
    // 发确认请求到渲染器，等用户回应
    return new Promise((resolve) => {
      e.sender.send("agent:request-confirm", data);
      ipcMain.once("agent:confirm-response", (_e, confirmed) => {
        resolve(confirmed);
      });
    });
  };

  return runBrowserAgent(
    { ...payload, sendProgress, requestConfirm },
    { runLocalAgentTurn, getContextSnapshotForTab }
  );
});

// 用户中断 agent
ipcMain.handle("agent:stop", (_e) => {
  stopCurrentAgent(); // 设置 abort flag
});
```

### 2.6 Preload Bridge 扩展

> 修改：`host/electron/preload.cjs`

```javascript
agent: {
  runBrowserTask: (payload) => ipcRenderer.invoke("agent:run-browser-task", payload),
  stop: () => ipcRenderer.invoke("agent:stop"),
  onProgress: (cb) => {
    ipcRenderer.on("agent:progress", (_e, data) => cb(data));
    return () => ipcRenderer.removeAllListeners("agent:progress");
  },
  onRequestConfirm: (cb) => {
    ipcRenderer.on("agent:request-confirm", (_e, data) => cb(data));
  },
  respondConfirm: (confirmed) => {
    ipcRenderer.send("agent:confirm-response", confirmed);
  },
},
```

---

## 三、OpenClaw 端要做什么

OpenClaw 在这个架构里只做一件事：**看快照 → 输出下一个动作**。无状态、单 turn。

### 3.1 Agent Prompt

```
你是 Sabrina 浏览器的操作助手。用户给了你一个任务，你在操作一个真实的网页来完成它。

## 任务
${task}

## 用户提供的数据
${userData ? formatUserData(userData) : "（用户未提供额外数据）"}

## 当前页面状态
URL: ${snapshot.url}
标题: ${snapshot.title}
滚动位置: ${snapshot.scrollPosition.y}/${snapshot.scrollPosition.scrollHeight}

### 可交互元素
${snapshot.interactiveElements.map(el =>
  `[${el.index}] <${el.tag}${el.type ? ' type='+el.type : ''}> "${el.text}" ${el.value ? '值="'+el.value+'"' : ''} ${el.disabled ? '[禁用]' : ''}`
).join('\n')}

### 页面文本
${snapshot.pageText}

## 操作历史（最近 5 步）
${recentJournal}

## 你的输出

每次只输出一个 JSON 动作：

点击元素：    {"action": "click", "index": 3, "reason": "点击提交按钮"}
填写字段：    {"action": "fill", "index": 5, "text": "张三", "reason": "填写姓名"}
选择下拉：    {"action": "select", "index": 7, "value": "北京", "reason": "选择城市"}
滚动页面：    {"action": "scroll", "direction": "down", "reason": "查看更多表单字段"}
跳转页面：    {"action": "navigate", "url": "https://...", "reason": "进入注册页"}
任务完成：    {"action": "done", "summary": "已填写完所有字段，等待用户确认提交"}
无法继续：    {"action": "error", "message": "页面要求验证码，需要用户手动完成"}

## 规则

1. 每次只输出一个动作，不要规划多步
2. 密码字段用 {"action": "fill", "index": N, "text": "__PASSWORD__"}，系统会提示用户自行输入
3. 如果页面有验证码(CAPTCHA)，输出 error 让用户处理
4. 如果连续两步操作了同一个元素但页面没变化，换一种方式或报告 error
5. 填写数据优先用"用户提供的数据"，没有提供的字段跳过或用 error 告知
6. 不要猜测用户没有提供的个人信息（地址、电话等）
7. 任务完成后，输出 done 并描述做了什么

只输出 JSON，不要解释。
```

### 3.2 LLM 选型

| 环节 | 推荐模型 | 原因 |
|------|---------|------|
| Agent 思考 | Sonnet（或 Haiku） | 每步都调一次，需要快+便宜，动作空间小不需要 Opus |
| 复杂规划 | 可选升级到 Sonnet | 如果连续 error 可以切换到更强模型重试 |

### 3.3 无需改 OpenClaw 核心

Agent 模式复用已有的 `runLocalAgentTurn()` 调用路径，不需要改 OpenClaw 本身。
每次 agent loop 就是一次普通的单 turn 调用，只是 prompt 不一样。

---

## 四、能解决哪些场景

### 第一优先级（MVP）

| 场景 | 用户说 | Agent 做什么 | 步数 |
|------|--------|-------------|------|
| **填表单** | "帮我用这些信息填表" | 识别字段 → 逐个 fill → 等确认 submit | 5-15 |
| **登录** | "帮我登录这个网站" | 找到账号密码框 → fill → click 登录 | 3-5 |
| **简单搜索** | "在这个网站搜 MacBook Pro" | 找到搜索框 → fill → click/enter | 2-3 |

### 第二优先级

| 场景 | 用户说 | Agent 做什么 | 步数 |
|------|--------|-------------|------|
| **多步导航** | "帮我找到退款页面" | click 导航 → scroll 找入口 → click 进入 | 5-10 |
| **信息提取循环** | "把前 5 页搜索结果都看一下" | scroll → 提取 → click 下一页 → 循环 | 10-20 |
| **表单 + 选择** | "注册一个账号" | 填表 → 选下拉 → 勾 checkbox → submit | 8-15 |

### 明确不做（V1）

| 场景 | 为什么不做 |
|------|-----------|
| 验证码 | 无法解决，必须交回用户 |
| 支付 | 安全风险太高 |
| 文件上传 | 需要系统级文件选择器交互 |
| 跨标签页操作 | 复杂度爆炸，先做单标签页 |
| Canvas/WebGL 应用 | 无 DOM，观察层无法工作 |

---

## 五、交互设计

### 5.1 入口：在 AI Sidebar 里触发

不新建 UI，复用已有的 AI Sidebar 聊天界面：

```
┌─────────────────────────────────┐
│  AI Sidebar                      │
│                                  │
│  [用户] 帮我把这个注册表单填了     │
│         我的信息：                │
│         姓名：张三                │
│         邮箱：zhangsan@mail.com  │
│                                  │
│  [AI] 好的，我来帮你填写。        │
│       识别到 6 个表单字段。       │
│                                  │
│  ┌─ Agent 操作流 ──────────────┐ │
│  │ ✓ 填写"姓名" → 张三         │ │
│  │ ✓ 填写"邮箱" → zhangsan@.. │ │
│  │ ● 正在填写"手机号"...       │ │
│  │                             │ │
│  │ ⚠️ 需要确认：               │ │
│  │ 点击"注册"按钮？            │ │
│  │ [确认] [跳过] [停止]        │ │
│  └─────────────────────────────┘ │
│                                  │
│  [停止 Agent ■]                  │
└─────────────────────────────────┘
```

### 5.2 操作流实时展示

每步操作在聊天流里实时追加，用紧凑的行内样式：

```
✓ 已完成    绿色对勾 + 灰色描述
● 进行中    蓝色圆点 + 动画
⚠️ 需确认   黄色/红色卡片 + 按钮
✗ 失败      红色叉 + 错误信息
⏭ 已跳过    灰色 + 划线
```

### 5.3 安全确认交互

**黄色操作**（提交表单等）：行内显示一行提示，2 秒后自动执行，用户可以在 2 秒内点"取消"

```
⚠ 即将点击"提交" [取消 2s]
```

**红色操作**（支付、密码、删除）：弹出卡片，必须手动确认

```
┌─────────────────────────────────┐
│ 🔴 需要你的确认                  │
│                                  │
│ Agent 想要：点击"立即支付 ¥299"  │
│ 页面：store.example.com         │
│                                  │
│ [确认执行]  [跳过这步]  [停止]    │
└─────────────────────────────────┘
```

**密码字段**：Agent 永远不填密码，改为提示用户自己输入

```
🔒 这个字段需要你手动输入密码
   Agent 已定位到密码框并聚焦。
   [输入完成后继续]
```

### 5.4 页面高亮（锦上添花，V2）

在被操作的标签页上，当前正在操作的元素用半透明蓝色边框高亮：

```javascript
// 注入到 webContents 的高亮脚本
el.style.outline = '2px solid rgba(99, 102, 241, 0.6)';
el.style.outlineOffset = '2px';
// 操作完成后移除
```

### 5.5 中断和恢复

- **随时停止**：底部常驻"停止"按钮，点击后 agent loop 退出，已完成的操作不回滚
- **不支持回滚**：填过的表单不自动清空（成本高、不可靠），告诉用户"已停止，你可以手动修改"
- **不支持恢复**：停止后重新开始，agent 会重新观察页面（已填的字段有 value，不会重复填）

---

## 六、任务管理层 — `AgentTaskManager`

> 新文件：`runtime/browser/AgentTaskManager.mjs`

Agent 任务需要一个管理器来处理生命周期：创建 → 运行 → 暂停 → 恢复 → 完成/失败/中断。

### 6.1 为什么需要

- Agent loop 是长时间运行的（可能 30s-2min），不能阻塞 IPC
- 用户可能同时操作其他标签页，agent 在后台等确认
- 需要持久化任务状态，方便 UI 渲染和历史回看
- 一个标签页同时只能跑一个 agent 任务

### 6.2 任务状态机

```
  create
    │
    ▼
 ┌──────┐   run    ┌─────────┐
 │ idle │────────▶│ running │◀──────────┐
 └──────┘         └────┬────┘           │
                       │                │
              ┌────────┼────────┐       │
              ▼        ▼        ▼       │
        ┌──────┐  ┌────────┐  ┌────┐   │
        │paused│  │completed│  │error│  │
        └──┬───┘  └────────┘  └──┬─┘   │
           │                     │      │
           │     resume          │ retry│
           └─────────────────────┴──────┘
                       │
                       ▼
                  ┌─────────┐
                  │cancelled│  ← 用户随时可中断
                  └─────────┘
```

### 6.3 数据结构

```javascript
/**
 * @typedef {object} AgentTask
 * @property {string}   taskId        — 唯一标识
 * @property {string}   tabId         — 操作的标签页
 * @property {string}   status        — idle|running|paused|completed|error|cancelled
 * @property {string}   userTask      — 用户的原始指令
 * @property {object}   userData      — 用户提供的数据（姓名、邮箱等）
 * @property {number}   currentStep   — 当前步数
 * @property {number}   maxSteps      — 最大步数（默认 20）
 * @property {Array}    journal       — 操作日志
 * @property {string}   pauseReason   — 暂停原因（等待用户确认 / 等待用户输入密码）
 * @property {object}   pendingConfirm — 当前等待确认的操作（如有）
 * @property {string}   summary       — 完成后的总结
 * @property {string}   error         — 错误信息
 * @property {number}   createdAt
 * @property {number}   updatedAt
 */
```

### 6.4 核心 API

```javascript
// 创建任务（不立即执行）
createAgentTask(tabId, userTask, userData?) → taskId

// 启动/恢复任务
startAgentTask(taskId) → void
// 内部调用 BrowserAgentService.runBrowserAgent()，以非阻塞方式

// 暂停（agent loop 在下一个 observe 前停下来）
pauseAgentTask(taskId) → void

// 用户回应确认
respondToConfirm(taskId, confirmed: boolean) → void

// 用户手动完成了某步（如输入了密码）
notifyManualStepDone(taskId) → void

// 中断
cancelAgentTask(taskId) → void

// 查询
getAgentTask(taskId) → AgentTask
getActiveTaskForTab(tabId) → AgentTask | null

// 事件
onTaskUpdate(callback) → unsubscribe
// 每次状态变化都 emit，UI 订阅即可
```

### 6.5 与 agent loop 的关系

```
AgentTaskManager          BrowserAgentService
      │                          │
      │  startAgentTask(id)      │
      │─────────────────────────▶│ runBrowserAgent(params)
      │                          │   │
      │  onProgress(data)        │   │ observe → think → ...
      │◀─────────────────────────│   │
      │  update task.journal     │   │
      │  emit onTaskUpdate       │   │
      │                          │   │
      │  onRequestConfirm(data)  │   │ risk=red → pause
      │◀─────────────────────────│   │
      │  set task.status=paused  │   │
      │  set task.pendingConfirm │   │ await Promise...
      │  emit onTaskUpdate       │   │
      │                          │   │
      │  respondToConfirm(true)  │   │
      │─────────────────────────▶│   │ resolve → execute → continue
      │  set task.status=running │   │
      │                          │   │
      │  cancelAgentTask(id)     │   │
      │─────────────────────────▶│   │ abort signal → loop exits
      │  set task.status=cancel  │   │
      │                          │   ▼
      │  onDone(result)          │ return { ok, journal }
      │◀─────────────────────────│
      │  set task.status=done    │
```

关键：TaskManager 持有 `AbortController`，cancel 时 signal 传入 agent loop。agent loop 每次迭代开头检查 `signal.aborted`。

### 6.6 一个标签页只能有一个活跃任务

```javascript
function createAgentTask(tabId, userTask, userData) {
  const existing = getActiveTaskForTab(tabId);
  if (existing && existing.status === 'running') {
    throw new Error('该标签页已有正在执行的 agent 任务');
  }
  // 如果有旧的 paused/error 任务，标记为 cancelled
  if (existing) existing.status = 'cancelled';
  // 创建新任务...
}
```

---

## 七、文件清单

### 新增

| 文件 | 职责 |
|------|------|
| `runtime/browser/PageAgentObserver.mjs` | 观察层：标注可交互元素 |
| `runtime/browser/PageActionExecutor.mjs` | 操作层：5 个原子操作 |
| `runtime/browser/ActionGate.mjs` | 安全层：风险分级 |
| `runtime/browser/BrowserAgentService.mjs` | 调度器：agent loop |
| `runtime/browser/AgentTaskManager.mjs` | 任务管理：生命周期、确认流、abort |
| `runtime/browser/BrowserAgentPromptService.mjs` | Agent 提示词构建 |
| `host/electron/register-agent-ipc-handlers.mjs` | IPC 注册 |
| `src/components/agent-action-stream.tsx` | 操作流 UI 组件 |
| `src/application/use-browser-agent-state.ts` | Agent 状态 hook |

### 修改

| 文件 | 改动 |
|------|------|
| `host/electron/ipc-handlers.mjs` | 加 `registerAgentIpcHandlers()` |
| `host/electron/preload.cjs` | 加 `agent: {}` 桥接 |
| `src/vite-env.d.ts` | 加 agent 相关类型 |
| `src/components/ai-sidebar.tsx` | 嵌入 agent 操作流 |

---

## 七、里程碑

### M1：看得见（1-2 天）
- `PageAgentObserver` — 能标注页面元素并返回结构化列表
- 在 sidebar 里展示标注结果（验证观察层可用）

### M2：动得了（2-3 天）
- `PageActionExecutor` — 5 个原子操作
- `ActionGate` — 安全分级
- 手动串一个 fill + click 验证操作层

### M3：能思考（2-3 天）
- `BrowserAgentService` — agent loop
- `BrowserAgentPromptService` — LLM 提示词
- 端到端跑通"帮我填表单"

### M4：体验完整（2-3 天）
- Agent 操作流 UI
- 安全确认交互
- 中断/停止
- 操作历史记录

---

## 九、关键设计决策备忘

| 决策 | 选项 | 选了什么 | 为什么 |
|------|------|---------|--------|
| 操作方式 | 截屏+坐标 vs DOM+编号 | DOM+编号 | 快、准、省 token，且我们就是浏览器 |
| LLM 通信 | tool_use vs 纯文本 JSON | 纯文本 JSON | 复用现有 runLocalAgentTurn，不改 OpenClaw |
| 安全机制 | 全部确认 vs 分级 | 三级分级 | 全部确认太烦，全自动太危险 |
| 状态管理 | 多 turn 会话 vs 每步单 turn | 每步单 turn + journal | 简单、无状态漂移、好 debug |
| 操作粒度 | 高级语义（fillForm）vs 原子（fill 单个字段）| 原子操作 | 通用性强，LLM 组合原子操作更灵活 |
| 密码处理 | Agent 填写 vs 交回用户 | 交回用户 | 安全红线，没得商量 |
