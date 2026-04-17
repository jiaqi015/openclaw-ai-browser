[English](./README_EN.md) | 中文

<p align="center">
  <img src="docs/icon.png" width="128" height="128" alt="Sabrina" />
</p>

<h1 align="center">Sabrina</h1>
<p align="center"><strong>一体的记忆 · 共用的 Skills · 覆盖日常 90% 电脑场景</strong></p>

<p align="center">
  <a href="https://github.com/jiaqi015/openclaw-ai-browser/stargazers"><img src="https://img.shields.io/github/stars/jiaqi015/openclaw-ai-browser?style=social" alt="Stars" /></a>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License" />
  <img src="https://img.shields.io/badge/platform-macOS-lightgrey" alt="Platform" />
  <img src="https://img.shields.io/badge/electron-35-47848F" alt="Electron" />
  <a href="https://github.com/jiaqi015/openclaw-ai-browser/releases"><img src="https://img.shields.io/github/v/release/jiaqi015/openclaw-ai-browser?label=download" alt="Download" /></a>
</p>

<p align="center">只有 IM 通道的 OpenClaw，是不完整的。<br/><strong>Sabrina 是它缺失的浏览器入口。</strong></p>
<p align="center">OpenClaw 管 IM，Sabrina 管浏览器。<br/>同一套 Skills，同一份记忆，同一个 AI 系统。</p>

---

<p align="center">
  <img src="docs/screenshot.png" width="900" alt="Sabrina — 浏览器 + AI 侧边栏" />
</p>

---

## 能做什么

OpenClaw 用户每天大量时间在浏览器里——查资料、读文档、看竞品、整理信息。这些场景里，IM 通道的 OpenClaw 帮不上忙。

Sabrina 补上这一块：**浏览器里的每一个页面，都能直接接入你在 OpenClaw 里已有的全部能力。** Skills 不用重新配，记忆不会断，模型策略继续生效。

打开一个网页，侧边栏里 Sabrina 已经知道你在看什么。页面就是输入，OpenClaw 就是引擎。

**典型场景：**

- 🤖 **Agent 模式** — 用自然语言描述任务，Sabrina 直接操作当前浏览器标签页：点击、填表、导航、滚动，最多连续执行 20 步。高风险操作（提交表单、删除数据等）会暂停并弹出确认，其余全程自主完成。侧边栏实时展示每一步的操作截图、AI 推理过程和风险评级
- ⚡ **Skills 直通浏览器** — 你配好的 OpenClaw skill 在任何网页里直接触发。看竞品文档时一键提 issue、读合同时一键生成摘要、浏览代码库时直接调 review skill——页面内容自动作为输入，无需复制
- ✨ **Coding GenTab** — 选中多个参考标签页，Sabrina 三步生成一个可交互的独立 HTML 页面：先规划设计形式（对比卡片 / 时间轴 / 搜索流等），再编写完整 HTML + CSS + JS，最后自动 QA 校验并修复错误。结果是真正可用的成果页，不是表格，不是聊天记录
- 🤝 **Handoff 后台任务** — 把任务移交给 OpenClaw 在后台异步执行，带上当前页面作为上下文。不用守着，继续浏览，任务完成自动回来
- 🧵 **记忆跟着页面走** — 对话历史按页面和站点自动归档，复用你在 OpenClaw 里已有的 memory 约定。下次打开同一个页面，上下文还在
- 📎 **多标签作为上下文** — 同时引用多个打开的标签页，把浏览器里的信息密度直接喂给 OpenClaw，而不是逐个复制粘贴

---

## 与其他方案的区别

|  | **Sabrina** | Tabbit | Sider / Monica 等插件 | BrowserOS / Dia 等 AI 浏览器 | ChatGPT / Claude 网页版 |
|--|:-----------:|:------:|:--------------------:|:---------------------------:|:----------------------:|
| **上下文来源** | 自动读取当前页 + 选区 + 多标签引用 | @mention 引用标签页、分组、文件、截图 | 手动选中或复制 | 部分自动，多依赖截图 | 完全手动粘贴 |
| **浏览器自动化** | ✅ Agent 模式，自然语言驱动真实操作，带风险拦截 | ✅ Background Agent（跨标签） | ❌ | ⚠️ 有限 | ❌ |
| **多标签协作** | ✅ 跨标签引用 + Coding GenTab | ✅ @group + 后台 Agent | ⚠️ 单页为主 | ⚠️ 有限支持 | ❌ |
| **AI 能力来源** | 复用你已有的 OpenClaw 全栈 | 内置多模型（GPT / Gemini / Claude 等） | 自建封闭系统 | 自建封闭系统 | 平台绑定 |
| **线程连续性** | ✅ 按页面 / 站点关联，跨会话保持 | ❌ 无明确会话持久化 | ❌ 每次独立 | ⚠️ 部分支持 | ❌ 每次独立 |
| **连接方式** | 本机 / SSH / HTTP Endpoint / Relay 配对码 | 云端 | 插件 | 内置 | 浏览器 |
| **开源** | ✅ MIT | ❌ 闭源 | ❌ | ❌ | ❌ |

> Sabrina 不重新造 AI，而是让你**已有的 OpenClaw** 在浏览器里原生工作。

---

## 快速开始

### 下载安装（推荐）

→ [Releases 页面](https://github.com/jiaqi015/openclaw-ai-browser/releases) 下载最新 `.dmg`

> ⚠️ 当前版本未签名，首次打开右键 → Open，或运行：`xattr -cr /Applications/Sabrina.app`

### 从源码运行

```bash
git clone https://github.com/jiaqi015/openclaw-ai-browser.git
cd openclaw-ai-browser
npm install
npm run dev
```

**前置条件：** macOS + Node.js 18+ + 本机或远端已安装 OpenClaw

### 连接 OpenClaw

1. 打开 Sabrina → `OpenClaw` 设置页
2. 选择连接方式：
   - **本机** — OpenClaw 在本机运行，直接连
   - **SSH 远程** — 填写 SSH 地址，远程执行
   - **HTTP Endpoint** — 填写 endpoint URL + access token，连接远端服务
   - **Relay 配对** — 生成 6 位配对码，连接远端 OpenClaw
3. 运行快速检查，连接成功即可使用

详见 [接入 OpenClaw 指南](docs/CONNECT_OPENCLAW.md)

---

## 核心功能

**🤖 Agent 模式** — 自然语言驱动浏览器自主操作。点击、填表、导航、滚动，最多 20 步连续执行；高风险操作前自动暂停确认；侧边栏实时呈现操作截图、推理过程、风险评级。

**✨ Coding GenTab** — 多标签内容 → 可交互 HTML 页面。三步流水线：设计规划 → 代码生成 → 自动 QA，JS 运行错误自动修复。

**🔍 页面上下文自动注入** — 打开侧边栏，Sabrina 已经知道你在看什么。

**🗂️ 多标签引用** — 同时引用多个标签页作为输入，把浏览器信息密度直接喂给 OpenClaw。

**⚡ Skills 直达** — OpenClaw skill ecosystem 在浏览器里直接可用，页面内容作为自然输入。

**🤝 Handoff** — 把任务和页面上下文一起移交给 OpenClaw 后台执行，不阻断当前浏览。

**🔄 模型实时切换** — 不出浏览器，直接在任务里换模型。

**🧵 线程记忆** — 对话历史按页面 / 站点自动归档，跨会话保持，复用 OpenClaw memory 约定。

**🔌 四种连接模式** — 本机直连、SSH 远程、HTTP Endpoint、Relay 配对码，适配任何网络环境。

---

<details>
<summary>💡 为什么做 Sabrina</summary>

Sabrina 不是"又一个 AI 浏览器"。

它是 **OpenClaw 在浏览器场景里的原生工作台**：把 OpenClaw 已有的 agent、skills、memory、model policy 和 runtime session，带进用户每天停留时间最长、上下文最丰富的工作表面。

大多数 AI 产品要求用户先离开页面，再去聊天框重建上下文。Sabrina 反过来：

- 不让用户复制链接和选区去"喂给" AI
- 不让用户重新描述自己正在看的内容
- 不让浏览器工作在进入 AI 前先中断一次

**用户正在看的页面，本身就是最重要的输入。**

Sabrina 最大的优势不是重新做一套 AI 平台，而是复用 OpenClaw 已经成立的能力层：agent、auth、model policy、skill ecosystem、session 约定。**换了场景，能力还在。**

</details>

<details>
<summary>🏗️ 架构</summary>

三层结构：浏览器 UI → 主进程 → OpenClaw（通过可插拔 driver）

```mermaid
flowchart LR
  subgraph Sabrina["Sabrina (Electron)"]
    UI["浏览器 UI\n标签栏 · 导航 · AI 侧边栏"]
    Main["主进程\n标签 · 线程 · 状态"]
    Context["页面上下文\n页面快照 · 选区 · 多标签引用"]
    Agent["Browser Agent\n自主操作 · 风险门控"]
  end

  subgraph Driver["连接层"]
    D1["local-cli"]
    D2["ssh-cli"]
    D3["endpoint"]
    D4["relay-paired"]
  end

  subgraph OpenClaw["OpenClaw"]
    OCA["Agent / Brain"]
    Eco["Models · Skills · Memory"]
  end

  UI -->|IPC| Main
  Main --> Context
  Main --> Agent
  Context -->|context package| Driver
  Agent -->|hands mode| Driver
  Driver --> OCA
  OCA --> Eco
  OCA -.->|response| Main
  Main -->|render| UI
```

</details>

---

## 文档

| 文档 | 内容 |
|------|------|
| [接入 OpenClaw](docs/CONNECT_OPENCLAW.md) | 四种连接方式的配置步骤 |
| [Browser Agent Design](docs/design-browser-agent.md) | Agent 模式设计：风险门控、Brain-Hands 架构 |
| [Turn Engine Design](docs/TURN_ENGINE_DESIGN.md) | turn 生命周期、执行规划、receipt normalization |
| [GenTab PRD](docs/GENTAB_PRD.md) | GenTab 完整产品需求、Coding GenTab 流水线 |
| [Engineering System](docs/ENGINEERING_SYSTEM.md) | 架构边界与工程约定 |
| [Design Baseline](docs/DESIGN_BASELINE.md) | UI 调性、组件约束与扩展规则 |
| [System State](docs/SYSTEM_STATE.md) | 当前系统全貌、哪些是真的、下一步 |

---

## Contributing

欢迎 PR 和 Issue。请先读 [Engineering System](docs/ENGINEERING_SYSTEM.md) 了解架构边界，跑 `npm run acceptance` 确认没有回归。

如果你觉得 Sabrina 有用，**点个 ⭐ 是最好的支持。**

## License

[MIT](./LICENSE)
