# Sabrina Engineering System

## Purpose

This repo needs one stable way to answer four questions before every meaningful change:

1. What must never regress?
2. Which user flows are release blockers?
3. What evidence counts as acceptance?
4. How do we iterate without blurring product boundaries?

This document is the governing layer for those questions.

Related reading:

- [Docs Guide](./DOCS_GUIDE.md)
- [System State](./SYSTEM_STATE.md)
- [Iteration Loop](./ITERATION_LOOP.md)
- [Acceptance Matrix](./ACCEPTANCE_MATRIX.md)

## Product Invariants

These invariants are mandatory. A change that breaks one of them is not complete.

### 1. Browser-first

Core browsing must remain usable when OpenClaw is unavailable.

Implications:

- Tabs can still be created, activated, navigated, reloaded, and closed.
- History, bookmarks, downloads, and internal surfaces still render.
- OpenClaw failures degrade AI features, not the browser shell.

### 2. Tab, Thread, and Session Are Different

`tab`, `thread`, and `session` are independent concepts and must stay that way.

Implications:

- A tab is the visible container.
- A thread is the user-facing conversational history.
- A session is the OpenClaw runtime context.
- Changes that merge any two of these concepts require an explicit architecture decision.

### 3. Main Process Owns Persisted Runtime State

Persisted runtime state belongs to the main process. Renderer code may subscribe to it, project it, and dispatch commands, but should not become the long-term source of truth for persisted state.

Implications:

- Thread, task, and OpenClaw runtime state should converge toward main-process authority.
- Renderer-only state is acceptable for transient UI concerns.

### 4. Text-first Browser Context

Structured text snapshots are the primary browser context contract.

Implications:

- Context extraction remains text-first and structure-aware.
- Browser turns should pass a stable Browser Context Package instead of ad hoc prompt fragments.
- Vision or screenshot tooling may be added later as a fallback or augmentation layer.
- Prompt construction must preserve the clean browser snapshot contract.

## Release Tiers

### P0

Blocker flows. Regressions here stop release work.

### P1

Core product capability. Regressions are acceptable only if they are intentionally deferred and explicitly tracked.

### P2

Improvement or enablement work. Useful, but not allowed to destabilize P0 or P1.

## Acceptance Stack

Acceptance is not a single check. Sabrina uses three layers:

### Layer 1. Automated gate

Run:

```bash
npm run acceptance
```

This is the repo-level minimum gate. It currently includes:

- `npm run test:runtime`
- `npm run test:electron-smoke`
- `npm run lint`
- `npm run check:architecture`

### Layer 2. Critical flow validation

Use the flow matrix in [ACCEPTANCE_MATRIX.md](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/docs/ACCEPTANCE_MATRIX.md).

This verifies that the product still behaves correctly for the user, not just for the compiler.

### Layer 3. Iteration and release discipline

Use [ITERATION_LOOP.md](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/docs/ITERATION_LOOP.md).

This governs how changes are scoped, rolled out, accepted, and learned from.

## Required Evidence

Every meaningful change should be able to answer:

- Which invariant was touched?
- Which critical flows were affected?
- Which automated gates passed?
- Which manual checks were run?
- What is the rollback or containment plan if the change is wrong?

## Stop-ship Rules

Stop and fix before continuing if any of these are true:

- A P0 flow is broken.
- Automated acceptance fails.
- Renderer and main process now disagree on a persisted runtime contract.
- A new capability depends on OpenClaw for a browser-only action that used to work without it.
- An internal experimental path is now user-visible without a clear fallback.

## Repo Assets

The engineering system lives in:

- `acceptance/acceptance.manifest.json`
- `scripts/check-architecture-invariants.mjs`
- `scripts/run-acceptance.mjs`
- [ACCEPTANCE_MATRIX.md](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/docs/ACCEPTANCE_MATRIX.md)
- [ITERATION_LOOP.md](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/docs/ITERATION_LOOP.md)
- [BROWSER_OPENCLAW_ARCHITECTURE.md](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/docs/BROWSER_OPENCLAW_ARCHITECTURE.md)
