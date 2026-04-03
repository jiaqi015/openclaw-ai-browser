# Sabrina Iteration Loop

This document defines how work should move from idea to release without drifting product boundaries or creating silent regressions.

## Default Change Loop

Every non-trivial change should move through these steps:

1. Diagnose
2. Scope
3. Implement
4. Verify
5. Accept
6. Learn

## 1. Diagnose

Clarify:

- What is actually broken or missing?
- Which invariant is involved?
- Which acceptance flows are affected?
- Is this a product change, a correctness fix, or an enabling refactor?

Output:

- Problem statement
- Affected flow list
- Risk tier: `P0`, `P1`, or `P2`

## 2. Scope

Choose one of these lanes:

### Lane A. Hotfix

For correctness issues on existing behavior.

Rules:

- Prefer the smallest coherent fix.
- Do not widen scope unless the root cause requires it.

### Lane B. Stabilization

For refactors that reduce future breakage.

Rules:

- Must preserve external product behavior.
- Must improve one of: contracts, ownership, observability, recovery.

### Lane C. Capability

For new product behavior.

Rules:

- Must declare user-visible impact.
- Must specify fallback behavior.
- Must not quietly promote experimental paths into default experience.

## 3. Implement

Implementation should keep these boundaries:

- Browser-only behavior does not become OpenClaw-dependent.
- Renderer code does not become the de facto owner of persisted runtime state.
- New async work should prefer a job-style lifecycle instead of ad hoc state paths.

## 4. Verify

Mandatory:

```bash
npm run acceptance
```

Then validate the relevant flows in [ACCEPTANCE_MATRIX.md](/Users/jiaqi/Documents/Playground/sabrina-ai-browser/docs/ACCEPTANCE_MATRIX.md).

## 5. Accept

Definition of done:

- Code path is coherent
- Acceptance gates pass
- Relevant manual flows were checked
- Residual risks are explicit
- Follow-ups are tracked instead of hidden

## 6. Learn

After each meaningful change, capture:

- What broke unexpectedly?
- Which invariant was hardest to preserve?
- Which check should become automated next?

## Change Budget

One iteration should generally change only one of these at a time:

- External product behavior
- State ownership model
- Execution contract

If a change touches more than one, treat it as an architecture change and document it before merging.

## Required Per-change Checklist

- Problem and scope are written down
- Impacted invariants are listed
- Impacted flows are listed
- `npm run acceptance` passed
- Manual smoke was run for changed flows
- Rollback or containment path is understood

## Rollout Policy

When the risk is medium or high:

- Ship correctness fixes before follow-on enhancements
- Keep refactors behavior-preserving
- Delay non-essential capability work if a P0 flow is still unstable

## What To Automate Next

The next automation targets should be:

1. Electron smoke coverage for P0 flows
2. Task-store subscription coverage
3. GenTab end-to-end flow validation
4. Thread continuity regression coverage

These should be added only after the current core contracts are stable.
