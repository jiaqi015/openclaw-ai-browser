[中文](./README.md) | English

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/icon.svg" />
    <source media="(prefers-color-scheme: light)" srcset="docs/icon.svg" />
    <img src="docs/icon.svg" width="128" height="128" alt="Sabrina" />
  </picture>
</p>

<h1 align="center">Sabrina</h1>
<p align="center"><strong>The native browser workspace for OpenClaw</strong></p>

<p align="center">
  <a href="https://github.com/jiaqi015/openclaw-ai-browser/stargazers"><img src="https://img.shields.io/github/stars/jiaqi015/openclaw-ai-browser?style=social" alt="Stars" /></a>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License" />
  <img src="https://img.shields.io/badge/platform-macOS-lightgrey" alt="Platform" />
  <img src="https://img.shields.io/badge/electron-35-47848F" alt="Electron" />
  <a href="https://github.com/jiaqi015/openclaw-ai-browser/releases"><img src="https://img.shields.io/github/v/release/jiaqi015/openclaw-ai-browser?label=download" alt="Download" /></a>
</p>

<p align="center">Most AI tools make you leave the page, then re-describe what you were just reading.<br/><strong>Sabrina doesn't. The page is the context.</strong></p>

---

## How Sabrina Compares

|  | Sabrina | Sider / Monica / Extensions | BrowserOS / Dia / AI Browsers | ChatGPT / Claude Web |
|--|:-------:|:---------------------------:|:-----------------------------:|:--------------------:|
| **Context source** | Auto-reads current page + selection + multi-tab refs | Manual select or copy | Partial auto, often screenshot-based | Fully manual paste |
| **Multi-tab collaboration** | First-class — cross-tab references + GenTab | Single page only | Limited support | Not supported |
| **AI capability source** | Reuses your existing OpenClaw stack | Self-contained closed system | Self-contained closed system | Platform-locked |
| **Thread continuity** | Auto-associated by page / site, persists across sessions | Each conversation isolated | Partial support | Each conversation isolated |
| **Model switching** | Real-time in-browser, reuses OpenClaw model policies | Fixed or limited choices | Fixed or limited choices | Platform-locked |
| **Skill ecosystem** | Reuses OpenClaw skill ecosystem | Limited built-in tools | Limited built-in tools | Plugin marketplace |
| **Offline browser** | Full browser, AI degrades gracefully | Depends on host browser | Full browser | Unavailable |

> **Sabrina doesn't reinvent AI — it lets your existing OpenClaw work natively in the browser.**

---

## What Sabrina Does

**Zero-friction page context** — Open the sidebar and Sabrina already knows what you're looking at. No copying. No describing. No pasting links.

**Multi-tab references** — Reference multiple open tabs as inputs simultaneously. Comparing three products? Analyzing multiple docs? Send them all in at once.

**GenTab** — Select multiple reference tabs, generate a structured result page in one click. Go from "reading the web" to "producing output."

**Skills in full context** — OpenClaw's skill ecosystem works directly in the browser. Page title, body text, and selections are all richer, more natural skill inputs than a plain chat box.

**Real-time model switching** — Switch models mid-task without leaving the browser.

**Thread memory** — Conversation history auto-associates with pages and sites. Close and reopen — the context is still there.

**Native OpenClaw binding** — Reuses your local agents, auth, model policies, and sessions. Not another install. Just connect your browser to the OpenClaw you already have.

---

## Quickstart

```bash
npm install
npm run dev
```

Prerequisites: OpenClaw installed and running locally, local OpenClaw gateway available.

```bash
# Run acceptance tests
npm run acceptance
```

---

## Why Sabrina

<details>
<summary>Read more</summary>

Sabrina is not "yet another AI browser."

It is **OpenClaw's native workspace for the browser**: bringing OpenClaw's existing agents, skills, memory, model policies, and runtime sessions into one of the most context-rich, highest-frequency work surfaces on your computer.

The browser is where users spend the most time — the richest context, closest to real tasks. Most AI products require users to leave the page first, then rebuild context in a chat box. Sabrina inverts this:

- No copying links and selections to "feed" the AI
- No re-describing what you're currently looking at
- No interrupting your browser workflow before engaging AI

It assumes by default: **The page you're looking at is the most important input.**

Sabrina's greatest advantage isn't rebuilding an AI platform from scratch — it's reusing OpenClaw's established capability layer:

- **Binding reuse** — directly connects to your local OpenClaw runtime
- **Token / auth reuse** — reuses local device auth and gateway authentication
- **Model reuse** — reuses existing model configurations and policies
- **Skill reuse** — existing OpenClaw skills work in the browser context
- **Memory conventions reuse** — reuses session / workspace conventions

> **Different surface. Same capabilities.**

</details>

## Architecture

<details>
<summary>View architecture diagram and request flow</summary>

Sabrina cleanly separates "browser engine, thread continuity, and OpenClaw runtime" into three distinct layers.

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

- **Browser-first** — Core browsing remains usable when OpenClaw is unavailable
- **Tab / Thread / Session separation** — Browser containers, user task history, and OpenClaw runtime context are three separate things
- **Main-process-owned runtime** — Durable state converges to the main process
- **Text-first context pipeline** — Structured page snapshots, not manual context pasting
- **Dedicated browser agent** — Connects via independent `sabrina-browser` agent, reusing the ecosystem while keeping workloads independent

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
- [Design Baseline](docs/DESIGN_BASELINE.md) — UI tone, thread system, component constraints and extension rules

## Contributing

PRs and issues welcome. Read [Engineering System](docs/ENGINEERING_SYSTEM.md) first to understand architectural boundaries, then run `npm run acceptance` to confirm no regressions.

## License

[MIT](./LICENSE)
