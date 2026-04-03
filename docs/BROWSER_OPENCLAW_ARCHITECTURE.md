# Sabrina Browser/OpenClaw Architecture

This document is the product-level boundary baseline for Sabrina's core loop:

1. The browser captures and organizes real page context.
2. Sabrina threads preserve user-visible continuity.
3. OpenClaw executes models, skills, and task handoff against that packaged context.

The goal is not "put prompts in a browser". The goal is to make Sabrina a native browser workspace that can reuse the OpenClaw ecosystem without losing browser truth, execution honesty, or user trust.

## Product Thesis

Sabrina only has defensible value if three things remain true at the same time:

- The browser stays first-class even when OpenClaw is unavailable.
- Browser context is packaged by Sabrina, not reconstructed by the user.
- OpenClaw is truly reused as an ecosystem, not copied as a second in-browser platform.

That means Sabrina must own the browser-side truth and OpenClaw must own the ecosystem-side execution.

## Domain Boundaries

### `runtime/browser`

Owns:

- tabs, navigation, and guest surfaces
- page extraction and normalization
- browser context packaging
- browser-native derived artifacts such as GenTab inputs

Must not own:

- user-facing conversation continuity
- durable OpenClaw binding or model policy
- skill success semantics

### `runtime/threads`

Owns:

- user-facing conversation history
- tab to thread binding
- durable thread storage and ordering
- turn lifecycle from user intent to appended thread message

Must not own:

- raw page extraction logic
- OpenClaw model or gateway policy
- Electron host details

### `runtime/openclaw`

Owns:

- binding discovery and bootstrap
- gateway health and chat routing
- model policy
- skill catalog normalization
- skill execution and trace semantics
- task recording

Must not own:

- raw browser page scraping
- Sabrina thread resolution
- renderer-specific UI state

### `host/electron`

Owns:

- Electron process lifecycle
- IPC registration
- platform host support
- browser host wiring

Must stay thin. It should compose runtime services, not become a fourth business domain.

### `src/renderer`

Owns:

- projection of runtime state
- UI composition
- transient UI state
- user intent dispatch

Must not become the durable owner of thread, browser, or OpenClaw runtime data.

## Relationship Model

Sabrina should be read as:

- Browser = truth of the current work surface
- Thread = truth of the user's visible continuity
- OpenClaw session = truth of agent execution continuity

They are related, but they are not the same object.

The browser can outlive or move independently of a thread.
A thread can survive navigation.
An OpenClaw session can be rotated, split, or made skill-specific without changing the user's thread identity.

## Browser Context Package

The core Sabrina contract is the Browser Context Package.

It is not:

- a free-form prompt
- a raw DOM dump
- a thread message
- an OpenClaw-native object

It is Sabrina's packaged runtime object that carries:

- one primary page snapshot
- zero or more referenced page snapshots
- selection state
- provenance about requested and missing references
- extraction-size stats for observability
- execution facts about source kind, trust boundary, reachability, reproducibility, and lossiness

Current implementation: [BrowserContextPackageService.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/runtime/browser/BrowserContextPackageService.mjs)

GenTab now also consumes this package through:

- [GenTabIpcActionService.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/host/electron/GenTabIpcActionService.mjs)
- [GenTabGenerationService.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/runtime/browser/GenTabGenerationService.mjs)

Why this matters:

- Browser extraction happens once per turn boundary, not ad hoc in every downstream layer.
- Prompts become views over the package, not the package itself.
- OpenClaw execution can reason about input shape explicitly.
- Browser-side routing facts can be computed once and reused instead of re-guessed in every downstream policy layer.
- Future caching, provenance, and richer modalities can extend the package without rewriting every caller.

## OpenClaw Reuse Strategy

True reuse means Sabrina should reuse OpenClaw in the following order:

1. Binding and auth reuse
2. Dedicated browser agent reuse
3. Model policy reuse
4. Skill catalog and readiness reuse
5. Workspace memory conventions reuse
6. Task and session trace reuse

It should not reuse OpenClaw by leaking raw browser behavior into OpenClaw or by pretending every OpenClaw skill is automatically browser-native.

## Connection Model

The product model should be:

- local = connect Sabrina to the user's OpenClaw
- remote = pair Sabrina with a remote OpenClaw

That distinction matters because the user should not experience the local case as
"managing devices". The local case is fundamentally one installation granting
another installation access on the same machine.

Current implementation baseline:

- connection is now explicit state, separate from generic OpenClaw pairing queues
- runtime keeps `connectionConfig` and `connectionState`
- UI can speak in terms of `disconnected / connecting / connected / attention`

Current implementation:

- [OpenClawStateModel.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/runtime/openclaw/OpenClawStateModel.mjs)
- [OpenClawStateStore.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/runtime/openclaw/OpenClawStateStore.mjs)
- [OpenClawSnapshotService.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/runtime/openclaw/OpenClawSnapshotService.mjs)
- [openclaw-settings-surface.tsx](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/src/components/openclaw-settings-surface.tsx)

## Profile-aware OpenClaw Control Plane

Sabrina must not silently assume one global OpenClaw home forever.

Even before remote transport exists, the connector needs a first-class transport
context so Sabrina can target:

- a chosen OpenClaw profile
- a chosen state dir
- the default local install

Without this layer, users with multiple profiles or non-default state dirs will
eventually connect Sabrina to the wrong control plane.

Current implementation:

- `OpenClawTransportContext` centralizes transport, profile, and state-dir hints
- CLI calls route through that context instead of hard-coded `openclaw ...`

Current implementation:

- [OpenClawTransportContext.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/runtime/openclaw/OpenClawTransportContext.mjs)
- [OpenClawClient.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/runtime/openclaw/OpenClawClient.mjs)
- [OpenClawConfigCache.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/runtime/openclaw/OpenClawConfigCache.mjs)

## Binding Contract

Sabrina should treat binding as a product contract, not as an incidental local
flag.

A durable Sabrina/OpenClaw binding should carry:

- Sabrina protocol version
- local or remote transport
- OpenClaw profile and state-dir targeting
- browser device identity
- agent identity
- capability set
- lifecycle timestamps

This keeps the local implementation compatible with future remote transport and
avoids a breaking rewrite when multiple browser instances or multiple OpenClaw
profiles are introduced.

Current implementation:

- [packages/sabrina-protocol/index.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/packages/sabrina-protocol/index.mjs)
- [OpenClawPresentationService.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/runtime/openclaw/OpenClawPresentationService.mjs)

### Dedicated Browser Agent

Sabrina should continue to use one browser-specific agent identity for browser work.

Why:

- browser work has different prompt framing, context density, and task mix
- it should not pollute the primary agent's short-term session state
- it still reuses the same underlying OpenClaw installation, policies, and ecosystem

### Skill Compatibility Is A First-class Concept

OpenClaw skills are an ecosystem. Sabrina must not treat them as one uniform type.

At minimum Sabrina needs a browser compatibility layer that answers:

- Can this skill consume page snapshots directly?
- Does it require URL or file inputs?
- Is it unsuited for browser invocation entirely?
- What hint should the user see before running it?

Current first step:

- skill metadata now carries `browserInputMode`
- normalized catalog/detail objects now also expose a structured `browserCapability` descriptor
- normalized skill metadata separates `declaredBrowserCapability` from final resolved `browserCapability`
- catalog summary now reports capability provenance counts and browser capability schema version
- runtime uses explicit input policy for strict skill execution
- Sabrina-side registry is treated as an explicit overlay, not as the long-term truth source

Current implementation:

- [OpenClawSkillPayloadService.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/runtime/openclaw/OpenClawSkillPayloadService.mjs)
- [BrowserSkillCapabilityService.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/runtime/openclaw/BrowserSkillCapabilityService.mjs)
- [BrowserSkillInputPolicyService.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/runtime/openclaw/BrowserSkillInputPolicyService.mjs)
- [SkillCatalogService.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/runtime/openclaw/SkillCatalogService.mjs)
- [BrowserSkillRegistry.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/runtime/openclaw/BrowserSkillRegistry.mjs)

Current routing policy for URL-native skills:

- public HTTP(S) pages route directly as source URLs
- local/private HTTP(S) pages still route as source URLs, but with explicit honesty constraints if OpenClaw cannot reach them from its own execution environment
- `file://` pages route only when Sabrina can safely resolve a real local absolute path for handoff, and only when the selected skill explicitly declares local-file support
- Sabrina internal surfaces, browser-internal pages, and other non-HTTP protocols are rejected explicitly instead of falling through to page-snapshot disguise

## Execution Honesty

Sabrina must never claim skill success unless the selected skill actually executed.

That means:

- explicit skill selection uses strict mode by default
- explicit skill failure receipts stay failures
- tool failure overrides fake success receipts
- trace extraction only reads evidence from the current request window

Current implementation:

- [OpenClawExecutionService.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/runtime/openclaw/OpenClawExecutionService.mjs)
- [SkillTraceService.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/runtime/openclaw/SkillTraceService.mjs)

## Browser Memory Bridge

Sabrina should not invent a second long-term memory platform. The browser should
produce structured browser memory, and OpenClaw should remain the long-lived
storage side.

That means the browser connector only needs a thin bridge for records such as:

- page summary
- page provenance
- user preference remembered from browser actions

Current first step:

- structured browser memory records can now be saved and searched through the
  Sabrina/OpenClaw runtime boundary
- the bridge is intentionally small and separate from workspace note scraping

Current implementation:

- [SabrinaMemoryBridgeService.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/runtime/openclaw/SabrinaMemoryBridgeService.mjs)
- [OpenClawRuntimeService.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/runtime/openclaw/OpenClawRuntimeService.mjs)
- [preload.cjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/host/electron/preload.cjs)

## Context Delivery Principles

Browser context delivery should obey these rules:

1. Extract once at the browser boundary.
2. Package before prompting.
3. Preserve provenance and lossiness flags.
4. Let execution strategy choose how to consume the package.
5. Keep the browser package product-native even if OpenClaw changes underneath.

This is the essence of the Sabrina context pipeline. The browser is not "supplying text to a model". It is organizing a bounded work packet with provenance.

Current implementation now also includes:

- short-lived extraction cache in [PageContextService.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/runtime/browser/PageContextService.mjs)
- Browser Context Package execution source descriptors and execution summary in [BrowserContextPackageService.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/runtime/browser/BrowserContextPackageService.mjs)
- Browser Context Package now also carries execution-grade facts such as `executionReliability`, `reachabilityConfidence`, `requiresBrowserSession`, `requiresFilesystemAccess`, and `reproducibilityGuarantee`
- thin turn-layer planning and receipt normalization in [TurnEngine.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/runtime/turns/TurnEngine.mjs), [TurnPlanner.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/runtime/turns/TurnPlanner.mjs), and [TurnReceiptService.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/runtime/turns/TurnReceiptService.mjs), including explicit `executionContract` planning and preflight `blocked` turns for incompatible strict skill routes
- separate turn journaling in [TurnJournalService.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/runtime/turns/TurnJournalService.mjs) and [TurnJournalStore.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/runtime/turns/TurnJournalStore.mjs), so Sabrina keeps its own durable turn evidence without collapsing it into thread messages
- turn journal is now queryable through the OpenClaw runtime boundary and included in doctor diagnostics
- GenTab artifact generation routed through the same turn boundary in [GenTabIpcActionService.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/host/electron/GenTabIpcActionService.mjs)
- host-level smoke coverage in [ThreadIpcActionService.test.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/host/electron/ThreadIpcActionService.test.mjs) and [GenTabIpcActionService.test.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/host/electron/GenTabIpcActionService.test.mjs)
- thread-to-turn-to-host P0 smoke in [ThreadTurnSmoke.test.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/host/electron/ThreadTurnSmoke.test.mjs)
- implementation-facing turn design in [TURN_ENGINE_DESIGN.md](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/docs/TURN_ENGINE_DESIGN.md)

## Plugin Boundary

The Electron app currently ships the runtime first, but the long-term release
shape should be split into:

- Sabrina desktop app
- Sabrina/OpenClaw protocol package
- npm-distributed OpenClaw plugin package

The plugin should stay a connector/control-plane surface, not a second copy of
browser product logic.

Current scaffold:

- [packages/openclaw-plugin-sabrina/package.json](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/packages/openclaw-plugin-sabrina/package.json)
- [packages/openclaw-plugin-sabrina/src/manifest.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/packages/openclaw-plugin-sabrina/src/manifest.mjs)
- [packages/openclaw-plugin-sabrina/README.md](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/packages/openclaw-plugin-sabrina/README.md)

Current local bridge baseline:

- Sabrina desktop now writes a loopback discovery file at `~/.sabrina/connector.json`
- Electron host exposes a narrow HTTP bridge for `health / status / connect / disconnect / doctor`
- the OpenClaw plugin package consumes that bridge through `openclaw sabrina ...` CLI commands
- connector manifest now explicitly advertises browser capability, browser memory, and remote session contract schema versions

Current implementation:

- [SabrinaConnectorBridge.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/host/electron/SabrinaConnectorBridge.mjs)
- [packages/openclaw-plugin-sabrina/openclaw.plugin.json](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/packages/openclaw-plugin-sabrina/openclaw.plugin.json)
- [packages/openclaw-plugin-sabrina/src/index.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/packages/openclaw-plugin-sabrina/src/index.mjs)
- [packages/openclaw-plugin-sabrina/src/bridge-client.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/packages/openclaw-plugin-sabrina/src/bridge-client.mjs)

## Remote Control Planes

Remote OpenClaw support must not be modeled as "local bridge, but farther away".
It should be modeled as a remote control-plane driver.

That means:

- product can still stay single-active: Sabrina talks to one OpenClaw at a time
- protocol should carry `transport` and `driver`
- SSH is only the first implemented remote driver, not the definition of remote
- future remote drivers such as relay pairing should plug into the same control-plane boundary
- browser/runtime UI should stay generic even when the current driver is `ssh-cli`

Current implementation baseline:

- remote connection config now carries a `driver` alongside optional SSH-specific fields
- runtime transport probing fails fast for unsupported remote drivers instead of pretending every remote target is SSH-capable
- plugin CLI exposes `--driver`, while `ssh-target` remains a driver-specific option for the current `ssh-cli` path

Current implementation:

- [OpenClawTransportContext.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/runtime/openclaw/OpenClawTransportContext.mjs)
- [OpenClawClient.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/runtime/openclaw/OpenClawClient.mjs)
- [OpenClawRuntimeService.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/runtime/openclaw/OpenClawRuntimeService.mjs)
- [packages/openclaw-plugin-sabrina/src/index.mjs](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/packages/openclaw-plugin-sabrina/src/index.mjs)

## Current Gaps

The repo is now materially better, but not "done". The biggest remaining architecture work is:

1. Add a real connect-code UX for the local fallback and future remote pairing path.
2. Continue pushing browser capability truth into explicit OpenClaw metadata so Sabrina overlay rules can shrink over time.
3. Expand host-level smoke from current service-boundary checks into a fuller desktop/Electron P0 flow when CI ergonomics allow.
4. Expand Browser Context Package execution facts from route safety into richer execution facts such as reachability confidence and reproducibility guarantees.
5. Add a second remote driver before productizing remote broadly, so "remote" is proven not to be SSH-shaped by accident.
6. Decide how strict plugin trust should be when `plugins.allow` is empty and local linked plugins can auto-load.

## Architectural Rule Of Thumb

If a new feature asks "what is the current browser context?", the answer should be:

1. ask `runtime/browser` for a Browser Context Package
2. let `runtime/threads` attach that package to a turn or task boundary
3. let `runtime/openclaw` decide execution strategy against that package

If code skips one of those layers, the boundary is probably drifting.
