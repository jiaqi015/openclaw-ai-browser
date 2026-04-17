# Sabrina GenTab PRD

这份文档描述 Sabrina **GenTab** 功能的当前实现与产品定义。

它基于仓库现状写成，不是概念稿，不是前瞻规划。

---

## 1. 产品定位

**GenTab = Generate Tab**

核心价值：把用户打开的多个标签页材料，直接生成一个新的、可继续工作的浏览器结果页面。

GenTab 代表 Sabrina 从"阅读网页"走向"生产结果页"。它是 Sabrina browser-native contract 的主链之一：

- **Browser owns truth**：浏览器负责页面快照与来源
- **Threads own continuity**：线程负责用户可见连续性
- **Turns own planning**：GenTab 生成是正式 turn
- **OpenClaw owns execution**：OpenClaw 负责生成与执行

---

## 2. 两条路径

GenTab 目前存在两条并行的生成路径，入口相同，产物和渲染方式完全不同。

### 2.1 Coding GenTab（主路径）

**当前主推路径**。AI 作为前端开发者，输出一个完整的自包含 HTML 文件，在 iframe 内直接运行。

- 没有 DSL、没有 schema block、没有渲染器配置——AI 决定一切形态
- 输出即产品：HTML 里包含 CSS 和 JS，可脱离 Sabrina 独立运行
- 对应 `schemaVersion: "coding"` 标识

### 2.2 Structured GenTab（旧路径）

**保留兼容的旧模式**。AI 输出结构化 JSON，前端按 type 选择对应渲染器展示。

- 支持 5 种预定义形态：`table` / `list` / `timeline` / `comparison` / `card-grid`
- 保留来源 item、sections、suggestedPrompts 等结构化字段
- 对应 `schemaVersion: "2"` 标识

---

## 3. Coding GenTab 详细规格

### 3.1 输入

| 字段 | 说明 |
|------|------|
| `referenceTabIds` | 用户选中的标签页 ID 列表，至少 1 个 |
| `userIntent` | 用户的自然语言意图描述 |
| `refinementText` | （可选）refinement 时的修改指令 |
| `originalHtml` | （可选）refinement 时的原始 HTML |

`preferredType` 对 Coding GenTab 无意义，忽略。

### 3.2 三阶段 pipeline

```
Pass 1: 设计规划（buildCodingGenTabPlanPrompt）
  输入：userIntent + tab contexts
  输出：{ title, design, layout, accent, keyData }
  目标：决定交互形态和视觉方向，不写代码

Pass 2: 代码生成（buildCodingGenTabPrompt with plan）
  输入：Pass 1 的 plan + tab contexts
  输出：{ success, title, intent, designChoice, html }
  目标：按 plan 写完整的自包含 HTML，填入真实数据

Pass 3: QA 验证（buildCodingGenTabVerifyPrompt）
  输入：Pass 2 生成的 HTML + 原始 tab contexts + plan
  输出：{ ok: true } 或 { ok: false, html: fixedHtml }
  目标：检查数据准确性、交互可用性、无占位符、JS 无错
```

**Pass 1 设计分类逻辑**（由 AI 执行）：

| 数据类型 | 推荐形式 | 主交互 |
|---------|---------|-------|
| 对比型（2-5 个同类实体） | 卡片对决 / 并排擂台 | 「帮我选」按钮 + 胜者动画 |
| 时序型（步骤/日程/流程） | 横向时间轴 / 进度条 | 点击节点展开 |
| 层级型（分类/多维属性） | 可翻转/折叠卡片组 | 翻转、展开、标签切换 |
| 单体型（一个主体） | 仪表盘 / 大数字英雄区 | 切换维度 |
| 列表型（10+ 同质条目） | 可搜索/过滤的卡片流 | 实时搜索或标签过滤 |
| 叙事型（长文要点/知识） | 知识卡片组 / 报纸版面 | 翻转展开、分页 |

**Pass 3 QA 检查项**：

1. 数据准确：每个具体数据（价格、名称、日期、规格）必须能在源页面中找到
2. 交互可用：所有可点击元素必须绑定有效事件处理函数
3. 无占位符：不允许 TODO、[INSERT]、"示例"、"sample"
4. JS 无错：无未定义变量、语法错误、空函数体
5. 方案符合：HTML 实现了 Pass 1 规划的形态（大方向一致即可）
6. 首屏完整：不滚动时能看到标题 + 主要数据 + 主交互
7. CSS 起手式：必须有 viewport meta 和 :root 变量，以及 onerror 兜底脚本

### 3.3 自动修复循环

生成完成展示后，iframe 内注入了错误上报脚本：

```js
window.onerror → 收集错误 → 800ms 后批量 postMessage 到父窗口
window.addEventListener('unhandledrejection') → 同上
```

父窗口监听逻辑（`CodingGenTabSurface`）：

- 只接受展示后 **8 秒内** 报告的错误（超时忽略，页面已稳定）
- 每次页面加载只触发一次修复（`autoFixFiredRef` 防重）
- 触发后自动调用 `handleRefine("自动检测到 JavaScript 错误，请修复：…")`
- UI 显示"检测到错误，正在自动修复…"横幅

### 3.4 输出 Schema

```json
{
  "schemaVersion": "coding",
  "type": "coding",
  "title": "标题",
  "intent": "一句话描述这张页面在帮用户做什么",
  "designChoice": "选择了什么形态，为什么（设计师视角，给用户看）",
  "html": "完整的自包含 HTML 字符串",
  "metadata": {
    "sourceTabIds": ["tab-id-1", "tab-id-2"],
    "userIntent": "用户的原始意图",
    "generatedAt": "2026-04-17T10:00:00.000Z"
  }
}
```

### 3.5 技术约束（写入 prompt）

- 单个完整 HTML 文件，CSS 和 JS 全部内联
- 禁止：Tailwind CDN、React、Vue、npm 依赖、fetch 外部请求、localStorage
- 允许 CDN：Chart.js、Animate.css、Alpine.js、Google Fonts
- 目标代码量：200–400 行
- CSS 起手式：深色 design token（`--bg`, `--surface`, `--text-1`, `--accent` 等）
- 所有数据硬编码在 HTML 里，不依赖任何运行时接口

### 3.6 Refinement

用户可以通过浮动工具栏的"优化"按钮对已生成页面提出修改要求。

Refinement 走独立 prompt（`buildCodingGenTabRefinementPrompt`）：

- 接收原始 HTML + 修改指令 + 原始 tab contexts
- 规则：最小改动，风格冻结，级联修复，数据来源只从 tab contexts 提取
- 输出：同 Pass 2 schema（`{ success, title, intent, designChoice, html }`）
- Refinement 完成后自动重新打开优化输入框，支持多次迭代

---

## 4. UI 交互

### 4.1 加载剧场（Loading Theatre）

生成过程中展示四阶段进度，每阶段有图标、主标签、副标签：

| 阶段 | 图标 | 主标签 | 进度点 |
|------|------|--------|--------|
| `reading` | 📖 | 正在读你打开的网页 | 12% |
| `thinking` | 💡 | 在想最合适的表现形式 | 32% |
| `coding` | ⌨️ | 开始写代码 | 65% |
| `checking` | 🔍 | 差不多了，自检一遍 | 88% |

- 阶段推进由主进程的真实 IPC progress 事件驱动（`onCodingProgress`）
- `thinking` 阶段的副标签展示 Pass 1 规划出的设计描述（真实内容）
- `coding` 阶段进度条有"慢爬"逻辑：从 65% 向 82% 渐近，防止长时间静止
- 兜底：2 秒内无 IPC 事件，自动进入 `reading` 阶段显示

### 4.2 结果页

生成完成后渲染：

```
absolute inset-0
├── FloatingToolbar（悬浮在顶部，hover 时完全不透明）
│   ├── Sparkles 图标 + 标题 + designChoice 注解
│   ├── 外部打开按钮（ExternalLink，写入 blob: URL 后调 openExternal）
│   ├── 复制 HTML 按钮（Copy/Check 状态切换）
│   ├── 优化按钮（Pencil，点击展开 refine 输入行）
│   └── 关闭按钮（X）
├── 自动修复横幅（isAutoFixing 时显示，pointer-events: none）
├── "自检发现问题，已自动修复" toast（wasFixed 时显示 4 秒）
└── iframe（srcDoc=instrumentedHtml，sandbox="allow-scripts allow-same-origin allow-forms allow-popups"）
```

### 4.3 错误状态

最简化：显示错误文本，提供重试和关闭按钮。

---

## 5. Structured GenTab 规格（旧路径）

### 5.1 输入

| 字段 | 说明 |
|------|------|
| `referenceTabIds` | 引用标签页 ID |
| `userIntent` | 用户意图 |
| `preferredType` | 期望形态：`auto` \| `table` \| `list` \| `timeline` \| `comparison` \| `card-grid` |

### 5.2 输出 Schema

```json
{
  "schemaVersion": "2",
  "type": "table",
  "title": "标题",
  "description": "描述",
  "summary": "总结",
  "insights": ["洞见 1", "洞见 2"],
  "sections": [
    {
      "id": "section-1",
      "title": "章节标题",
      "description": "章节说明",
      "bullets": ["要点 1", "要点 2"]
    }
  ],
  "suggestedPrompts": ["下一步建议"],
  "sources": [
    {
      "url": "https://example.com",
      "title": "来源标题",
      "host": "example.com",
      "whyIncluded": "为什么纳入"
    }
  ],
  "items": [
    {
      "id": "item-1",
      "title": "项目标题",
      "description": "项目描述",
      "sourceUrl": "https://example.com",
      "sourceTitle": "来源标题",
      "sourceTabId": "tab-id（用于 Live Cells 追踪）",
      "quote": "从源页面提取的原文片段（30-120字）",
      "fields": { "价格": "¥20", "平台": "macOS" },
      "date": "2026-04-07"
    }
  ],
  "metadata": {
    "sourceTabIds": ["tab-id-1"],
    "userIntent": "用户意图",
    "generatedAt": "ISO 时间戳",
    "preferredType": "auto",
    "lastCellRefreshAt": "（单元格刷新时更新）"
  }
}
```

### 5.3 Live Cells

每个 item 保存 `sourceTabId` 和 `quote`，用于追踪来源标签页是否仍然存在、内容是否已漂移。用户可以对单条 item 执行刷新，重新从最新页面提取内容，不需要重新生成整个 GenTab。

### 5.4 UI 结构

```
页面整体（overflow-y-auto）
├── 头部：图标 + 标题 + type badge + 来源数量 + 关闭/重新生成
├── 生成中：进度条 + 当前意图展示 + 取消
├── 错误：图标 + 错误信息 + 重试/关闭
└── 完成后：
    ├── 摘要区（summary + insights）+ Refine 区（修改意图 + 形态选择 + 建议提问）
    ├── 来源卡片列表
    ├── Sections 卡片网格
    └── 工作视图（type 切换 tab + 对应渲染器）
```

形态切换在同一结果页内发生，无需重新生成。

---

## 6. 存储

两条路径共用 `GenTabStore`：

- `pendingById`：正在生成中的 GenTab 元数据（`referenceTabIds` + `userIntent` + `preferredType`）
- `genTabsById`：已生成完成的 GenTab 数据

本地持久化到 `gentab-state.json`，写入使用 tmp 文件 + rename 保证原子性。

`GenTabStore.isValidGenTabData` 同时接受 `schemaVersion: "1" | "2"`（Structured 路径）。Coding GenTab 数据（`schemaVersion: "coding"`）在进入 store 之前以 `type: "coding"` 兼容写入，但当前 `isValidGenTabData` 校验只针对 Structured 路径——Coding GenTab 的数据直接在 IPC 层管理，不走这一校验路径。

---

## 7. 路由逻辑

`sabrina://gentab/{genId}?v=coding` → `CodingGenTabSurface`

`sabrina://gentab/{genId}`（无 `v` 参数）→ `GenTabSurface`（Structured 路径）

意图检测（`detectCodingGenTabIntent`）在聊天输入框侧判断用户消息是否应自动路由到 Coding GenTab，而非进入普通对话线程。触发条件：明确提到"创意网页"/"交互页面"/`gentab`，或符合"帮我做一个网页"等高置信度模式。

---

## 8. 当前实现状态

| 模块 | 路径 | 状态 |
|------|------|------|
| Coding pipeline | `runtime/browser/GenTabCodingService.mjs` | ✅ |
| Structured pipeline | `runtime/browser/GenTabGenerationService.mjs` | ✅ |
| 存储 | `runtime/browser/GenTabStore.mjs` | ✅ |
| IPC 路由 | `host/electron/GenTabIpcActionService.mjs` | ✅ |
| Coding UI | `src/components/coding-gentab-surface.tsx` | ✅ |
| Structured UI | `src/components/gentab-surface.tsx` | ✅ |
| Coding 状态机 | `src/application/use-coding-gentab-state.ts` | ✅ |
| Structured 状态机 | `src/application/use-gentab-surface-state.ts` | ✅ |
| 类型定义 | `src/lib/gentab-types.ts` | ✅ |
| 意图检测 | `src/lib/coding-gentab-intent.ts` | ✅ |
| Live Cells 刷新 | `buildRefreshItemPrompt` + `refreshItem` | ✅ |
| 自动修复循环 | iframe error reporter + auto-refine | ✅ |
| 三阶段 pipeline | plan → code → verify | ✅ |

---

## 9. 非功能约束

**性能**：上下文收集复用现有快照；Coding GenTab 生成通常需要 60–120 秒（三个 LLM pass）；进度条使用慢爬动画避免视觉静止。

**安全**：iframe sandbox 限制为 `allow-scripts allow-same-origin allow-forms allow-popups`，不允许访问外部资源；生成的 HTML 中所有数据必须硬编码，禁止 fetch。

**存储**：本地持久化，不引入中心化存储依赖；结果通过用户已有的 OpenClaw 路径生成。

**容错**：
- LLM 输出非 JSON 时尝试提取（`extractJsonFromOutput`）；完全失败时尝试直接提取 HTML 片段（`rescueHtmlFromFreeformOutput`）
- QA pass 发现问题 → 输出修复后 HTML；无法解析 QA 输出 → 透传原始 HTML（不破坏用户体验）
- 运行时 JS 错误 → 8 秒内自动触发修复 pass
