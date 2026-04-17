# Sabrina Design Baseline

[← 返回 README](../README.md)

基于当前仓库实现整理出来的 **UI 调性说明、线程系统总结、组件约束与扩展规则**。适合继续做 UI、交互、页面扩展、线程相关功能时查阅。

说明：

- 当前环境里没有额外可读取的项目外部线程资源、评论线程导出或 MCP 线程数据。
- 因此本文中的"线程总结"，指的是 **Sabrina 产品内的对话线程系统**，不是 PR 评论流、Vercel toolbar thread 或 issue discussion。
- 如果后续接入外部讨论线程，需要单独补一章，不要混写。

## 2. 产品气质总述

Sabrina 的 UI 不是传统意义上的"网页皮肤"，而是一个 **浏览器主界面 + AI 侧边协作层 + 线程记忆系统** 的组合体。它的调性可以概括为：

1. **浏览器优先，AI 陪伴而不抢戏**
   主内容永远是网页本身，AI 作为右侧协作层存在，界面应该帮用户聚焦内容，而不是反客为主。

2. **深色、半透明、桌面化**
   整体是偏 macOS / visionOS 的深色桌面语言，不是扁平 Web App，也不是高饱和 SaaS 面板。

3. **高级感来自材质和节奏，不来自炫技**
   主要靠透明度、模糊、边框、轻阴影、微动效、圆角和排版层级建立品质感，而不是大面积彩色渐变或重 UI 装饰。

4. **信息密度要高，但不能乱**
   历史线程、引用页、技能、模型状态、诊断信息都偏密集，但通过文本层级、容器层级和留白来控住复杂度。

5. **线程不是功能附属，而是 UI 的核心结构**
   Sabrina 的聊天体验不是单次问答，而是围绕"当前页面 / 当前站点 / 引用页面 / 历史线程"组织的连续协作体验。

## 3. 整体界面结构

应用主结构由三层组成：

### 3.1 根容器

`App.tsx` 根节点使用：

- `frosted` 模式时：`apple-gradient`
- `liquid` 模式时：`liquid-shell`

这意味着最底层并不是纯色底，而是带有轻度氛围感的背景层。

### 3.2 顶部双层浏览器壳

浏览器顶部不是单层导航，而是两层：

- 第一层：标签栏，`h-12`，使用 `surface-toolbar-strong`
- 第二层：导航栏，`h-14`，使用 `surface-toolbar`

视觉上，第一层更稳、更压缩；第二层更偏操作与输入。

### 3.3 内容区

内容区有三种典型形态：

- 浏览器网页内容
- 内部页面内容：历史 / 书签 / 下载 / 设置 / 技能馆 / 诊断中心 / 绑定向导 / GenTab
- 新标签页欢迎态与对话态

### 3.4 AI 侧边栏

AI 侧边栏只在 `surfaceMode === "browser"` 时出现，位于右侧，具备：

- 弹簧展开/收起
- 拖拽调宽
- 线程历史展开
- 引用页选择
- 技能快捷入口
- 模型切换
- 对话流
- 后台交给 OpenClaw 的 handoff

它不是"聊天窗"，而是浏览器中的协作工作台。

## 4. 视觉系统

## 4.1 主题 Token

`src/index.css` 中已经定义了核心主题变量：

```css
--font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "PingFang SC", "Helvetica Neue", sans-serif;
--color-apple-blue: #007AFF;
--color-apple-pink: #FF2D55;
--color-apple-purple: #AF52DE;
```

结论：

- 字体优先走系统原生体验，不引入额外品牌字体。
- 品牌强调色是蓝、粉、紫三色，但 **当前实现里真正高频承担"AI 主按钮"和"核心动作"职责的是 pink**。
- blue 目前更像保留 token，而不是主导 UI 的显性色。

## 4.2 双玻璃模式

当前 UI 已经实现两套玻璃模式：

### `frosted`

- 默认模式
- 更暗、更稳、更适合连续阅读
- 对比更高
- 更接近"深色桌面毛玻璃"

### `liquid`

- 可在设置中切换
- 更亮、更通透、更悬浮
- 高光、边框和内阴影更明显
- 更接近苹果新一代液态玻璃语言

规则：

- 新组件不应该再发明第三套材质模式。
- 需要材质差异时，应优先复用现有类，而不是临时手写一套新视觉。

## 4.3 背景与容器层级

当前容器类已经分出明确职责：

| 类名 | 语义 | 典型用途 |
| --- | --- | --- |
| `surface-screen` | 页面底层内容区 | 新标签页、设置页、历史页、诊断页 |
| `surface-toolbar` | 常规工具栏 | 浏览器导航栏 |
| `surface-toolbar-strong` | 更厚重的工具栏 | 标签栏 |
| `surface-sidebar-shell` | 右侧 AI 壳层 | Sabrina 侧边栏 |
| `surface-panel` | 标准信息面板 | 卡片区、输入区、设置区块 |
| `surface-menu` | 浮层菜单 | 浏览器下拉菜单 |
| `surface-card-selectable` | 可点击卡片 | 历史线程、设置项、引用页 |
| `surface-input` | 常规输入框 | 搜索框、地址栏、小输入 |
| `surface-input-hero` | 欢迎态大输入框 | 新标签页首页 |
| `surface-button-system` | 中性系统按钮 | 设置、刷新、切换、次级操作 |
| `surface-button-ai` | AI 主操作按钮 | 发送 |
| `surface-button-ai-soft` | AI 轻强调按钮 | 技能选中态、GenTab 触发 |
| `surface-pill` | 小型分段式切换按钮 | 历史对话 / 引用 |
| `surface-chip` | 中性标签 | 引用页 chip |
| `surface-chip-ai` | AI 强调标签 | 已选技能 |
| `surface-badge` | 弱信息徽章 | 当前模式、当前搜索引擎 |

### 实际风格特征

- 大部分深度靠 `rgba(255,255,255, x)` 的透明白叠加出来。
- 容器边框基本都是半透明白边。
- `liquid` 模式额外叠加高光、内阴影和更强饱和模糊。
- 阴影主要用于"浮起"，不是传统厚重投影。

## 4.4 颜色策略

### 底色

常见底色包括：

- `#050505`
- `#0a0a0a`
- `#03050b`
- `rgba(12, 15, 22, x)` 系列深色混合层

原则：

- 不要使用中灰色做主容器背景。
- 黑底不是纯死黑，而是带一点冷色倾向的深色。

### 强调色

实际使用角色如下：

- `apple-pink`
  - 发送按钮
  - AI 类按钮
  - 技能相关强调
  - 部分 AI 状态色
- `green / emerald`
  - 连接成功
  - 正常状态
  - 完成态
- `red / rose`
  - 异常态
  - 错误标签
- `amber`
  - 警告、处理中间态
- `yellow`
  - 书签星标

规则：

- 强调色只用于"有意义的状态"。
- 不要把 pink 扩散成大面积背景色。
- 不要让一个普通系统页突然变成彩色面板。

## 4.5 文本层级

当前项目的文字透明度体系已经很稳定，可以总结为：

| 层级 | 典型透明度 | 典型用途 |
| --- | --- | --- |
| 一级文本 | `text-white` / `text-white/88` / `text-white/85` | 标题、主内容、主要对话内容 |
| 二级文本 | `text-white/70` / `text-white/60` / `text-white/58` | 描述、说明、普通正文 |
| 三级文本 | `text-white/50` / `text-white/46` / `text-white/42` / `text-white/40` | 预览、次要标签、辅助说明 |
| 四级文本 | `text-white/35` / `text-white/30` / `text-white/28` / `text-white/20` | 时间、状态、弱提示、提示行 |

规则：

- 透明度就是信息层级，不要乱配。
- 如果一个页面看起来"全都在抢视线"，先降透明度层级，而不是先调颜色。

## 5. 排版系统

## 5.1 字体

统一使用系统字体栈。目标不是品牌字体辨识度，而是：

- macOS 原生感
- 中英文混排稳定
- 在 Electron 中显示一致

## 5.2 字号梯度

当前代码里的实际字号大致如下：

| 用途 | 常见字号 |
| --- | --- |
| 页面一级标题 | `text-3xl`、`text-4xl`、`text-[30px]` |
| 二级标题 | `text-lg`、`text-base` |
| 正文 | `text-sm`、`text-[13px]` |
| 预览与说明 | `text-[12px]`、`text-[11px]` |
| 微标签 | `text-[10px]`、`text-[9px]` |

补充说明：

- 新标签页欢迎态允许更大的字号，因为它承担品牌首页的气质。
- 侧边栏聊天正文比新标签页消息区略小，更强调密度。
- 微标签高频使用 `uppercase + tracking`，这是 Sabrina 的一个明显语气特征。

## 5.3 圆角尺度

Sabrina 的圆角偏大、偏软，常见尺寸：

- `rounded-lg`
- `rounded-xl`
- `rounded-2xl`
- `rounded-[18px]`
- `rounded-[20px]`
- `rounded-[24px]`
- `rounded-[26px]`
- `rounded-[28px]`
- `rounded-[32px]`
- `rounded-full`

规则：

- 越大的容器，圆角越大。
- 不允许突然出现硬直角块。
- 历史卡片、引用页卡片、设置卡片等，都应该维持柔和一致的圆角家族。

## 5.4 间距节奏

整体采用 4px / 8px 网格，体现在：

- `gap-1.5 / gap-2 / gap-3 / gap-4`
- `px-3 / px-4 / px-5 / px-6`
- `py-1.5 / py-2 / py-3 / py-5`

规则：

- 通过间距区分层级，不要靠堆更多边框。
- 面板内部必须给内容呼吸空间。
- 复杂页面优先把模块切成多个 `surface-panel` 或卡片区，而不是做一整块大杂烩。

## 6. 动效与交互节奏

Sabrina 的动效风格是 **快、轻、带一点弹性**，而不是慢吞吞的展示动画。

### 当前关键参数

- 侧边栏展开/收起：`spring`, `damping: 25`, `stiffness: 200`
- 历史/引用面板折叠：`duration: 0.15`
- 菜单弹出：`opacity + y + scale`, `duration: 0.15`
- 新标签页底部输入区出现：`duration: 0.18`, `easeOut`
- 回到最新按钮：`spring`, `damping: 24`, `stiffness: 260`

### 交互反馈规律

- hover 主要通过：
  - 背景轻微提亮
  - 字色提亮
  - 边框更清晰
- 重要主按钮允许轻微 `scale`
- 激活态通常表现为：
  - 更亮的底
  - 更清晰的边框
  - 更高的文字对比

规则：

- 不要引入重型动画。
- 不要让 hover 效果比内容还显眼。
- 动效目标应该是"让切换顺一点"，不是"做表演"。

## 7. 核心界面分解

## 7.1 Browser Chrome

`browser-chrome.tsx` 定义了 Sabrina 的浏览器壳层气质：

- 标签栏卡片化，而不是传统贴片式标签
- 当前激活标签底部有一条 `apple-pink` 活动指示线
- 地址栏使用 `surface-input`
- 侧栏入口按钮与更多菜单按钮走同一套圆形 icon button 语言

风格关键词：

- 紧凑
- 精致
- 桌面工具感
- 比系统浏览器更轻、更软

## 7.2 AI Sidebar

`ai-sidebar.tsx` 是最能代表产品调性的界面。

它由上到下分成五层：

1. 连接状态头部
   - 显示 OpenClaw 连接状态
   - 包含远程 / 本机标记

2. 最爱的技能
   - 三列快捷技能入口
   - 激活态走 AI 轻强调

3. 历史线程入口
   - 用 pill 按钮切历史对话
   - 边上显示当前引用数量或当前页状态

4. 主对话流
   - 用户消息有淡底
   - assistant 消息透明底
   - 错误消息使用 pink
   - skill trace 作为 assistant 回复下的次级展开区

5. 底部工作区
   - 引用页开关
   - 引用页 chip
   - 已选技能 chip
   - GenTab 触发按钮
   - 多行输入框
   - 模型切换
   - 后台 handoff
   - 主发送按钮

这是 Sabrina 最复杂也最需要保持一致性的区域。

## 7.2.1 Agent 模式 UI

当用户触发浏览器自动化任务时，AI 侧边栏进入 Agent 模式，由 `agent-action-stream.tsx` 负责渲染整个状态流。

### 状态机

```
idle → running → paused（风险确认）→ completed / error / cancelled
```

- `idle`：无任务，组件不渲染（`journal` 为空时直接返回 null）
- `running`：任务执行中，实时追加步骤
- `paused`：遇到高风险操作，等待用户 confirm/reject，此时状态为 `"paused"`
- `completed`：绿色完成态
- `error` / `cancelled`：红色中止态

### 运行中 UI

运行时顶部出现 `AgentLiveBanner`：

- 红色发光容器：`bg-[#FF2D55]/10 border-[#FF2D55]/25 shadow-[0_0_20px_rgba(255,45,85,0.08)]`
- 内部有 ping 动画红点 + `"Sabrina Agent 运行中"` 字样 + 已执行步骤数
- banner 下方是 shimmer 进度条：`h-[2px]`，渐变从透明经 `#FF2D55` 到透明，`1.8s` 无限循环横扫

### 步骤卡片（StepCard）

每个 `AgentActionEntry` 渲染为一张卡片，包含：

- **操作截图缩略图**：`w-10 h-10 rounded-lg`，hover 时 `scale-110`，有红色遮罩蒙层；无截图时显示操作类型图标
- **AI 推理**（`reasoning` 字段）：斜体引用文本，`text-zinc-300`
- **操作描述**（`summary` 或格式化的 `action`）：`text-zinc-400`
- **风险徽章**：`risk === "red"` 时显示 `⚠ 高风险`，`bg-[#FF2D55]/20 text-[#FF2D55]`，圆角胶囊
- 卡片底色随状态变化：成功→ emerald，失败→ red，完成→ green，最新步骤→ `white/[0.04]`

步骤类型到中文标签的映射（`STATUS_STEP_LABELS`）：`observe`、`think`、`action-start`、`action-success`、`action-error`、`verify-start`、`verify-success`、`verify-fail`、`done`、`error`。

日志区最大高度 `380px`，溢出滚动，**最新步骤在最上方**（reverse 排列）。

### 正在思考指示器（ThinkingCard）

当最后一条 journal 事件是 `think` 且 status 为 `running` 时，显示 `ThinkingCard`：

- 蓝紫色（indigo）容器
- 三个错落跳动的小点，`1.2s` 循环

### 风险确认对话框

遇到高风险操作时，agent 发出 `onRequestConfirm` 事件，状态切为 `"paused"`，渲染 `pendingConfirm` 块：

- 红色发光容器（同 live banner 配色）
- 操作原因文本（`pendingConfirm.reason`）
- 两个按钮：**确认执行**（红底 `#FF2D55`）/ **跳过**（灰底 `zinc-800`）
- 用户点击后调用 `onConfirm(true/false)` → `respondConfirm()` → `agent.confirmResponse()`

### 停止按钮

`status === "running"` 时右上角显示 `⬛ 停止 Agent` 按钮，点击调用 `stopTask()` → `agent.stop()`，随时可中断任务，最终状态变为 `"cancelled"`。

### Task Plan Tree View

任务拆解视图（`PlanOverview`）在 `taskTree` 非空且 `status === "running"` 时显示在 live banner 下方。

每个任务节点显示：
- 状态圆点：`done`→ 绿色 ✓，`active`→ 红色 → + pulse，`pending`→ 灰色序号
- 任务标题：`done` 时加删除线，`active` 时白色高亮
- `taskTree` 由后端通过 `onProgress` 事件的 `data.taskTree` 字段推送，前端无需主动拉取

## 7.3 New Tab Surface

新标签页有两种气质：

### 欢迎态

- 居中大标题
- 英雄输入框 `surface-input-hero`
- 左上模型选择
- 发送按钮嵌在输入框右侧

### 对话态

- 进入聊天后，结构会向侧边栏消息流靠拢
- 底部出现固定输入区
- 保留"回到最新"按钮

这意味着新标签页不是纯导航页，而是"浏览入口 + AI 起始页"。

## 7.4 Settings / Diagnostics / Binding / Skills

虽然这些页面功能差异大，但视觉上都遵守同一原则：

- 使用 `surface-screen` 做页面基底
- 用 `surface-panel` 或可点击卡片组织信息
- 标题清晰，说明文本弱化
- 操作按钮克制，不做重操作台风格

其中：

- `general-settings`：偏轻设置页，强调预览和应用
- `settings`：偏绑定与引导页
- `diagnostics`：信息密度最高，但仍保持深色玻璃体系
- `skills`：偏目录型页面，适合做卡片分组、推荐、本地隐藏、收藏

## 8. 线程系统总结

这一章是本文最重要的部分之一。

## 8.1 线程的定义

在 Sabrina 里，线程是：

- 当前页面或当前站点关联的对话上下文
- 历史记录与消息列表
- 选中的引用页集合
- 已选择的 composer skill
- pending 状态
- 后续 AI 会话 session 的锚点

线程不只是消息数组，而是一个完整的交互上下文。

## 8.2 线程创建与复用规则

`src/state/useThreadState.ts` 中的复用逻辑如下：

1. 如果标签页运行时已经绑定线程，且 URL 没变，继续复用。
2. 如果 URL 变化，但前后 **同源**，则复用同一线程。
3. 如果能命中 `pageKey`，则复用该页面历史线程。
4. 否则创建新线程。

这里的 `pageKey` 规则：

- 对普通 URL，会去掉 hash 后再作为 key
- `about:blank` 和 `internal://` 页面不参与 pageKey 映射

这套规则意味着：

- 同站点内部跳转倾向于保留上下文
- 同一具体页面再次打开时，也可能回到原线程
- Sabrina 的线程模型偏"页面协作连续性"，不是"每次问一句都开新会话"

## 8.3 线程基础元数据

线程记录包括：

- `threadId`
- `title`
- `originUrl`
- `pageKey`
- `siteHost`
- `siteLabel`
- `updatedAt`

其中：

- 标题优先取标签页标题
- `siteLabel` / `siteHost` 用于历史线程展示
- 当页面标题或 URL 变化时，这些信息会被同步更新

## 8.4 线程持久化

线程有两套持久化路径：

### Web fallback

- `localStorage`
- key: `sabrina-thread-state-v1`

### Electron 桌面环境

- 主进程文件：`thread-state.json`
- 路径来自 `app.getPath("userData")`
- 主进程负责：
  - state 规范化
  - 临时文件写入
  - 原子替换
  - 向 renderer 广播最新线程状态

这意味着：

- 真正的桌面版本线程历史不是只存在前端内存里
- README 以后写到线程持久化时，必须区分 web fallback 与 Electron 正式路径

## 8.5 线程排序逻辑

线程不是固定顺序，而是"最近活跃优先"：

- 新线程创建时会移到最前
- 追加消息时会移到最前
- 手动选中历史线程时也会移到最前

因此历史面板的顺序本质上是 **最近更新顺序**。

## 8.6 线程摘要如何生成

`threadSummaries` 由以下信息组成：

- 标题：线程标题
- 预览：最后一条非 `system` 消息
- 站点信息：`siteLabel` / `siteHost`
- 时间：`formatThreadTimestampLabel`
- 状态：
  - 默认 `active`
  - 如果最后一条非 system 消息是 error，则标记为 `error`

时间显示格式当前是：

- `MM/DD HH:mm`
- 中文区域格式
- 24 小时制

## 8.7 历史线程面板的分组规则

`chat-history-panel.tsx` 当前实现：

- 支持搜索
- 搜索范围包括：
  - title
  - preview
  - siteLabel
  - siteHost
- 结果按 `updatedAt` 倒序
- 再按日期分组：
  - 今天
  - 昨天
  - 具体日期
- 每个日期下再分：
  - 上午
  - 下午

这说明"历史对话"不是简单列表，而是带时间感和回溯感的轻量时间轴。

## 8.8 线程切换的真实语义

当用户在历史面板点一个线程时，当前行为是：

- 将 **当前激活 tab 的运行时线程绑定** 切换到目标线程
- 不会自动新开 tab
- 不会强制跳转线程原始 URL

这点非常重要：

- 它是"把当前工作上下文切换到另一条对话线"
- 不是"打开一个历史会话页面"

以后如果要做"线程回到原网页"的能力，需要单独定义交互，不要误以为现在已经有。

## 8.9 线程中的引用页

引用页是线程级状态，不是全局状态。

规则如下：

- 当前线程可维护一组 `selectedReferenceIds`
- 会自动排除当前活动 tab
- tab 消失后，会自动清理失效引用
- 成功完成一次 AI 对话或 handoff 后，会清空引用

UI 体现：

- 引用入口是底部 `引用` pill
- 已选引用会变成 chip
- 当引用页数量达到 2 个以上，且已连接 OpenClaw 时，可以触发 GenTab

## 8.10 线程中的技能状态

已选技能同样是线程级状态。

这意味着：

- A 线程选中的技能，不应污染 B 线程
- 切换线程后，composer skill 需要跟随线程恢复

UI 表达方式：

- 已选技能显示为 `surface-chip-ai`
- 发送成功后，如果这次请求走的是 skill，会清理当前已选 skill

## 8.11 消息流显示规则

当前消息角色包括：

- `user`
- `assistant`
- `system`
- `error`

展示规则：

- 正常界面默认隐藏 `system` 消息
- `user` 消息有更淡的背景底
- `assistant` 是主内容区
- `error` 用 pink 文案突出

线程预览也不会取 `system` 消息，而是取最后一条可见消息。

## 8.12 Skill Trace

assistant 消息下方可以挂 `skillTrace`。

UI 设计上它是：

- 次级信息块
- 默认折叠
- 展开后显示 step 列表
- 每个 step 显示：
  - 标题
  - exit code
  - duration
  - detail

语义上这是"执行过程证据"，不是正文内容的一部分。

## 8.13 交给 OpenClaw 后台处理

`sendToOpenClaw()` 不是普通回复，而是异步 handoff：

- 当前线程先追加 user 消息
- 再把当前页和引用页上下文拼成任务 prompt
- 后台以独立 session 交给 OpenClaw
- UI 再返回一条确认型 assistant 消息

这会影响文案调性：

- handoff 回复更像"任务交接确认"
- 普通 ask 回复更像"即时协作回答"

后续写文案时，这两类消息不能混成一个口吻。

## 8.14 GenTab 的线程语义

当前触发条件：

- 已连接 OpenClaw
- 当前线程选中了至少 2 个引用页
- 当前没有正在生成中的 GenTab

用户确认后：

- 会弹 `confirm`
- 生成任务在后台进行
- 完成后在新标签页打开 GenTab

这说明：

- GenTab 不是孤立功能，它是线程上下文、引用页和用户意图共同作用的结果
- README 在描述它时，必须把它归类到"线程扩展能力"，不能只写成一个普通按钮

## 9. 组件设计规则

## 9.1 输入框

当前有两套输入：

### 常规输入 `surface-input`

用于：

- 地址栏
- 历史搜索
- 引用页搜索

特征：

- 半透明深底
- hover 略提亮
- focus 用更亮边框和很轻的外层 ring

### 英雄输入 `surface-input-hero`

用于：

- 新标签页首页大输入框

特征：

- 更高
- 更强阴影
- 更高视觉权重

规则：

- 不要把 hero 输入样式拿去普通表单滥用。
- 普通设置页和列表页一律优先用 `surface-input`。

## 9.2 按钮

按钮分为三类：

### `surface-button-system`

- 中性系统按钮
- 用于设置、刷新、切换、辅助入口

### `surface-button-ai`

- 强强调主按钮
- 几乎只应该用于"发送 / 发起 AI 主动作"

### `surface-button-ai-soft`

- AI 相关的柔和强调
- 用于技能激活、GenTab、快捷 AI 状态

规则：

- 一个区域里尽量只有一个强主按钮。
- `surface-button-ai` 不要在普通列表页泛滥。

## 9.3 Pill / Chip / Badge

这三个虽然都小，但语义不同：

### Pill

- 是"切换器"
- 例如：历史对话、引用

### Chip

- 是"已选择对象"
- 例如：引用页面、技能

### Badge

- 是"静态状态说明"
- 例如：已应用毛玻璃、当前搜索引擎

不要混用。

## 9.4 可点击卡片

`surface-card-selectable` 是 Sabrina 最重要的基础卡片之一，常见于：

- 历史线程
- 引用页
- 设置导航
- 外观模式选项
- 搜索引擎选项
- 绑定目标选择

规则：

- 默认轻底
- hover 提亮
- active 更亮并边框更清晰
- 圆角通常在 `18px - 24px`

如果新功能需要"列表项可选中"，优先复用这套语义。

## 9.5 Markdown 内容区

`.markdown-body` 已经内建：

- 统一字号
- 段落间距
- 列表样式
- 内联 code 样式

规则：

- assistant 正文优先包在 `.markdown-body` 中
- 不要局部手搓另一套 markdown 文本规范

## 10. 状态设计

## 10.1 空状态

Sabrina 的空状态特点：

- 居中
- 大图标
- 弱透明度
- 低压文案

适用场景：

- 新线程无消息
- 无下载
- 过滤后无日志
- 无历史线程

## 10.2 加载状态

当前加载状态主要是：

- `Loader2 + animate-spin`
- 低对比提示文案
- 对长任务额外说明"可能需要几十秒"

这很符合 Sabrina 的协作型产品气质，应继续保留。

## 10.3 错误状态

当前错误态主要分两种：

### 内容型错误

- 出现在聊天流里
- 用 `error` message role
- 文字 pink

### 结构型错误

- 出现在线程卡片、日志、连接状态中
- 用 rose / red / amber 小范围提示

规则：

- 错误应该清楚，但不能炸屏。
- 不要大面积红底。

## 11. 设计约束与当前例外

这里要特别强调"现状"和"规范"必须分开写。

### 11.1 当前已实现、可以视为规范的部分

- 双玻璃模式
- 深色半透明容器系统
- 线程历史时间分组
- 引用页选择与 chip 呈现
- skill trace 次级展开结构
- 浏览器顶栏 + 右侧 AI 侧栏的双主结构

### 11.2 当前代码中的例外与待收敛项

1. **GenTab 已迁移到 Sabrina 自己的玻璃态启动面板**
   现在不再依赖原生 `alert` / `confirm`。启动 GenTab 时，用户会在 AI 侧栏里先完成目标草案和视图偏好，再生成新的工作台页。

2. **不是所有内部页都走"重毛玻璃"**
   像历史、下载、诊断等页面，很多区域是 `surface-screen + panel` 的更平衡布局，而不是满屏重材质。

3. **图标体系不只 `lucide-react`**
   虽然大部分图标来自 `lucide-react`，但当前还存在：
   - `CustomAIIcon`
   - `SystemEntryIcon`
   - `LobsterHandoffIcon`
   - `gentab-icon.svg`
   所以更准确的规则是：**业务通用图标优先 `lucide-react`，品牌/系统/产品专用图标允许封装成组件或资产。**

4. **外观设置入口已经收敛到内部页**
   - `general-settings`
   现在 glass mode 只保留在内部设置页里，不再保留额外的弹层入口。

## 12. 新功能扩展准则

如果你要继续给 Sabrina 加 UI，建议按下面的顺序决策：

1. 先判断它属于哪种层级
   - 壳层
   - 面板
   - 卡片
   - 次级信息块
   - 状态标签

2. 再判断它属于哪种语义
   - 切换
   - 选择
   - 展示
   - 强主操作
   - AI 辅助操作

3. 最后再选类名
   - 先复用已有 `surface-*`
   - 不够用再新增
   - 新增时必须同时考虑 `frosted` 和 `liquid`

### 必须遵守

- 保持深色、克制、半透明
- 优先复用已有视觉语义
- 文本层级用透明度区分
- 重要操作数量尽量少
- 线程相关状态必须是线程级，不要偷偷做成全局态

### 尽量避免

- 高频大色块
- 纯灰大面板
- 新发明一套按钮体系
- 线程和 tab 语义混乱
- 不带层级的密集信息墙

## 13. 推荐参考文件

新增功能时，优先参考这些实现：

| 场景 | 参考文件 |
| --- | --- |
| 浏览器壳层 | `src/components/browser-chrome.tsx` |
| AI 侧边栏 | `src/components/ai-sidebar.tsx` |
| 历史线程列表 | `src/components/chat-history-panel.tsx` |
| 引用页选择 | `src/components/tab-reference-picker.tsx` |
| 欢迎页输入 | `src/components/new-tab-surface.tsx` |
| 设置页结构 | `src/shell/SurfaceRouter.tsx` |
| 线程状态与持久化 | `src/state/useThreadState.ts`、`runtime/threads/ThreadStore.mjs` |
| AI 交互动作 | `src/commands/useChatCommands.ts` |
| 全局视觉 token | `src/index.css` |
| Agent 模式 UI 渲染 | `src/components/agent-action-stream.tsx` |
| Agent 状态管理 | `src/application/use-browser-agent-state.ts` |

## 14. 一句话总结

Sabrina 的 UI 调性不是"做一个漂亮的深色界面"，而是：

> 用克制的桌面玻璃壳层，包住浏览器和 AI 协作；
> 用线程把页面、上下文、引用和技能串起来；
> 让界面永远服务连续思考，而不是打断思考。

后续所有 UI 改动，都应该优先维护这三件事：

- 浏览器仍然是主舞台
- AI 是协作层，不是噪音层
- 线程是产品骨架，不是附属功能
