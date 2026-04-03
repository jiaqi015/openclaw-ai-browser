[English](./README_EN.md) | 中文

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/icon.svg" />
    <source media="(prefers-color-scheme: light)" srcset="docs/icon.svg" />
    <img src="docs/icon.svg" width="128" height="128" alt="Sabrina" />
  </picture>
</p>

<h1 align="center">Sabrina</h1>
<p align="center"><strong>OpenClaw 在浏览器里的原生工作台</strong></p>

<p align="center">
  <a href="https://github.com/jiaqi015/openclaw-ai-browser/stargazers"><img src="https://img.shields.io/github/stars/jiaqi015/openclaw-ai-browser?style=social" alt="Stars" /></a>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License" />
  <img src="https://img.shields.io/badge/platform-macOS-lightgrey" alt="Platform" />
  <img src="https://img.shields.io/badge/electron-35-47848F" alt="Electron" />
  <a href="https://github.com/jiaqi015/openclaw-ai-browser/releases"><img src="https://img.shields.io/github/v/release/jiaqi015/openclaw-ai-browser?label=download" alt="Download" /></a>
</p>

<p align="center">大多数 AI 工具要你先离开页面、再去描述你刚才在看什么。<br/><strong>Sabrina 不需要。页面本身就是上下文。</strong></p>

---

## 和其他方案的区别

|  | Sabrina | Sider / Monica 等插件 | BrowserOS / Dia 等 AI 浏览器 | ChatGPT / Claude 网页版 |
|--|:-------:|:--------------------:|:---------------------------:|:----------------------:|
| **上下文来源** | 自动读取当前页 + 选区 + 多标签引用 | 手动选中或复制 | 部分自动，多依赖截图 | 完全手动粘贴 |
| **多标签协作** | 一等公民 — 跨标签引用 + GenTab | 单页为主 | 有限支持 | 不支持 |
| **AI 能力来源** | 复用你已有的 OpenClaw 全栈 | 自建封闭系统 | 自建封闭系统 | 平台绑定 |
| **线程连续性** | 按页面 / 站点自动关联，跨会话保持 | 每次对话独立 | 部分支持 | 每次对话独立 |
| **模型切换** | 浏览器内实时切换，复用 OpenClaw 模型策略 | 固定或有限选择 | 固定或有限选择 | 平台绑定 |
| **技能生态** | 复用 OpenClaw skill ecosystem | 内置有限工具 | 内置有限工具 | 插件市场 |
| **浏览器离线** | 主链路完整，AI 优雅降级 | 依赖宿主浏览器 | 完整浏览器 | 不可用 |

> **Sabrina 不重新造 AI，而是让你已有的 OpenClaw 在浏览器里原生工作。**

---

## 核心能力

**页面上下文自动注入** — 打开侧边栏，Sabrina 已经知道你在看什么。不需要复制，不需要描述，不需要粘贴链接。

**多标签引用** — 同时引用多个标签页作为输入。比较三个产品？分析多份文档？全部一起送进去。

**GenTab** — 选中多个引用页，一键生成结构化结果页面。从"阅读网页"变成"生产成果"。

**技能直达** — OpenClaw 的 skill ecosystem 直接在浏览器里用。页面标题、正文、选区都是更自然的 skill 输入。

**模型实时切换** — 不用出浏览器，直接在当前任务里换模型。

**线程记忆** — 对话历史按页面 / 站点自动关联。关掉再打开，上下文还在。

**OpenClaw 原生接入** — 复用本机已有的 agent、auth、model policy、session。不是再安装一套，而是把浏览器接进你已经在用的 OpenClaw。

---

## Quickstart

```bash
npm install
npm run dev
```

前提：本机已安装并可运行 OpenClaw，本机 OpenClaw gateway 可用。

```bash
# 验收测试
npm run acceptance
```

---

## 为什么做 Sabrina

<details>
<summary>展开阅读</summary>

Sabrina 不是"又一个 AI 浏览器"。

它是 **OpenClaw 在浏览器场景里的原生工作台**：把 OpenClaw 已有的 agent、skills、memory、model policy 和 runtime session，带进电脑上最富上下文、最高频的工作表面之一。

浏览器是用户每天停留时间最长、上下文最丰富、最接近真实任务现场的地方。大多数 AI 产品都要求用户先离开页面，再去聊天框里重建上下文。Sabrina 反过来：

- 不让用户复制链接和选区去"喂给" AI
- 不让用户重新描述自己正在看的内容
- 不让浏览器工作在进入 AI 之前先中断一次

它默认认为：**用户正在看的页面，本身就是最重要的输入。**

Sabrina 最大的优势，不是重新做一套 AI 平台，而是复用 OpenClaw 已经成立的能力层：

- **Binding reuse** — 直接接入本机 OpenClaw 运行环境
- **Token / auth reuse** — 复用本地 device auth、gateway 鉴权
- **Model reuse** — 复用已有模型配置与策略
- **Skill reuse** — 已有 OpenClaw skills 在浏览器里继续工作
- **Memory conventions reuse** — 复用 session / workspace 约定

> **换了场景，能力还在。**

</details>

## Architecture

<details>
<summary>展开查看架构图与请求链路</summary>

Sabrina 把"浏览器内核、线程连续性、OpenClaw runtime"拆成清晰的三层。

```mermaid
flowchart LR
  subgraph Sabrina["Sabrina Browser"]
    Renderer["Renderer UI\nBrowser Chrome / AI Sidebar / Internal Surfaces"]
    Preload["Preload Bridge\nwindow.sabrinaDesktop"]
    Main["Electron Main Process\nruntime authority"]
    TabMgr["Tab Manager\nreal tabs / navigation / WebContentsView"]
    Context["Context Pipeline\ntext-first page snapshot"]
    Threads["Thread Store\nuser-facing task history"]
    OCState["OpenClaw State Store\nbinding / model / skills / pairing / tasks"]
    Tasks["Task Store\nbackground handoff records"]
    Page["Real Web Page\ncurrent page / selection / referenced tabs"]
  end

  subgraph OpenClaw["OpenClaw"]
    Adapter["OpenClaw Adapter\nbinding / agent lifecycle / routing"]
    Gateway["Gateway / CLI / Auth"]
    Agent["Dedicated Browser Agent\nsabrina-browser"]
    Ecosystem["Models / Skills / Memory Conventions"]
  end

  Renderer --> Preload
  Preload --> Main
  Main --> TabMgr
  TabMgr --> Page
  Page --> Context
  Main --> Threads
  Main --> OCState
  Main --> Tasks
  Main --> Adapter

  Context --> Adapter
  Adapter --> Gateway
  Gateway --> Agent
  Gateway --> Ecosystem
```

**Design Principles**

- **Browser-first** — 浏览器主链路在 OpenClaw 不可用时仍然成立
- **Tab / Thread / Session 分离** — 浏览器容器、用户任务历史、OpenClaw runtime context 是三件事
- **Main-process-owned runtime** — durable state 收敛到主进程
- **Text-first context pipeline** — 结构化页面快照，而不是让用户手工补上下文
- **Dedicated browser agent** — 通过独立 `sabrina-browser` agent 接入 OpenClaw，复用生态但保持工作负载独立

**Request Flow**

```mermaid
sequenceDiagram
  participant U as User
  participant UI as Sabrina UI
  participant Main as Electron Main
  participant Ctx as Context Pipeline
  participant OC as OpenClaw Adapter
  participant GW as OpenClaw Gateway
  participant AG as sabrina-browser Agent
  participant TS as Thread Store

  U->>UI: Ask / select text / reference tabs
  UI->>Main: runAiAction + active thread + selected references
  Main->>Ctx: Extract current page and referenced page snapshots
  Ctx-->>Main: Browser Context Package
  Main->>OC: Route packaged browser context
  OC->>GW: Reuse local auth / model / session routing
  GW->>AG: Execute on dedicated browser agent
  AG-->>GW: Response / skill trace / model info
  GW-->>OC: Runtime result
  OC-->>Main: Normalized response
  Main->>TS: Persist thread messages
  Main-->>UI: Render reply / update thread / update state
```

</details>

---

## Docs

- [Engineering System](docs/ENGINEERING_SYSTEM.md)
- [Acceptance Matrix](docs/ACCEPTANCE_MATRIX.md)
- [Iteration Loop](docs/ITERATION_LOOP.md)
- [Browser/OpenClaw Architecture](docs/BROWSER_OPENCLAW_ARCHITECTURE.md)
- [Turn Engine Design](docs/TURN_ENGINE_DESIGN.md) — Sabrina turn lifecycle、execution planning、receipt normalization
- [Design Baseline](docs/DESIGN_BASELINE.md) — UI 调性、线程系统、组件约束与扩展规则

## Contributing

欢迎 PR 和 Issue。请先读 [Engineering System](docs/ENGINEERING_SYSTEM.md) 了解架构边界，跑 `npm run acceptance` 确认没有回归。

## License

[MIT](./LICENSE)
