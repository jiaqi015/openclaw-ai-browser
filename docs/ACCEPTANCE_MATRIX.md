# Sabrina Acceptance Matrix

This matrix defines the flows that matter, what "pass" means, and which evidence should exist before a change is treated as complete.

## How To Use

1. Identify which flows a change touches.
2. Run `npm run acceptance`.
3. Validate the relevant manual checks below.
4. Record failures as explicit follow-up work, not hidden assumptions.

## P0 Flows

### 1. Browser core

Tier: `P0`

Scope:

- Create a tab
- Activate a tab
- Navigate to a URL or search term
- Reload
- Go back and forward
- Close tabs until one remains

Pass criteria:

- The shell remains responsive.
- Tabs and visible browser chrome stay synchronized.
- No OpenClaw requirement is introduced for browser-only actions.

Evidence:

- `npm run acceptance`
- Manual smoke in the desktop app

### 2. Thread continuity

Tier: `P0`

Scope:

- Thread creation from page context
- Same-page reuse
- Same-origin reuse rules
- Page refresh and restore behavior

Pass criteria:

- Active thread follows the intended tab/thread/pageKey model.
- Refresh or ordinary navigation does not silently destroy user conversation history.
- Messages still persist and restore across app launches.

Evidence:

- `npm run acceptance`
- Manual smoke across at least two tabs on the same site

### 3. Local OpenClaw binding

Tier: `P0`

Scope:

- Local binding refresh
- Binding setup
- Model selection
- Gateway health and degraded-state behavior

Pass criteria:

- Browser remains usable even if OpenClaw fails.
- Binding state and model state remain coherent in the UI.
- Degraded mode is visible and understandable.

Evidence:

- `npm run acceptance`
- Manual check with OpenClaw available
- Manual check with OpenClaw unavailable or intentionally disconnected

### 4. AI ask, quick actions, and skill fallback

Tier: `P0`

Scope:

- Ask flow
- Summarize
- Key points
- Explain selection
- Assist-mode skill fallback

Pass criteria:

- User message, pending state, assistant response, and error states all align.
- Skill fallback produces visible traceable behavior instead of silent failure.
- Selection-dependent actions fail clearly when selection is missing.
- URL-native skills fail honestly on Sabrina internal/non-HTTP pages and only use `file://` inputs when Sabrina can hand off a safe local absolute path to a skill that explicitly supports local files.

Evidence:

- `npm run acceptance`
- `npm run test:electron-smoke`
- Manual smoke with one ready skill and one unavailable skill

## P1 Flows

### 5. Background handoff and task recording

Tier: `P1`

Scope:

- Send to OpenClaw background handoff
- Task persistence
- Task event visibility

Pass criteria:

- Handoff completes or fails with a task record.
- The renderer can observe task updates through a stable interface.
- The main process remains the source of persisted task data.

Evidence:

- `npm run acceptance`
- Manual smoke of one successful and one failed handoff

### 6. GenTab generation

Tier: `P1`

Scope:

- Start GenTab from selected references
- Persist pending metadata
- Generate result
- Completion event
- Retry
- Close

Pass criteria:

- Starting GenTab creates one coherent flow, not multiple hidden state paths.
- Pending metadata exists before the generated surface mounts.
- Completion clears generation lockout so another GenTab can start later.
- Retry uses the same contract as the initial run.

Evidence:

- `npm run acceptance`
- `npm run test:electron-smoke`
- Manual smoke with at least two referenced tabs

### 7. Internal surfaces

Tier: `P1`

Scope:

- History
- Bookmarks
- Downloads
- Diagnostics
- Settings
- Skills

Pass criteria:

- Internal surfaces still behave like stable tab content.
- Surface routing remains coherent with browser chrome state.
- No internal surface requires OpenClaw unless it is explicitly OpenClaw-specific.

Evidence:

- `npm run acceptance`
- Manual navigation across each internal surface

## Release Decision

A release candidate is acceptable only when:

- All automated gates pass
- No P0 flow is broken
- All changed P1 flows have either passed validation or been explicitly deferred with a tracked follow-up

## Manual Validation Record

For each change, keep a short record:

- Changed area:
- Affected flows:
- Automated gate result:
- Manual checks run:
- Known residual risk:
