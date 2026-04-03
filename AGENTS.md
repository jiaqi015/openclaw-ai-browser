# Sabrina Repo Guide

This repo inherits the global Codex memory system and the active project space memory.

Before meaningful repo work, read:

- `/Users/jiaqi/.codex/memories/MEMORY.md`
- `/Users/jiaqi/.codex/memories/projects/users-jiaqi-documents-playground/MEMORY.md`
- `/Users/jiaqi/.codex/memories/projects/users-jiaqi-documents-playground/topics/sabrina-product-direction.md`
- `docs/ENGINEERING_SYSTEM.md`
- `docs/ACCEPTANCE_MATRIX.md`
- `docs/ITERATION_LOOP.md`

## Repo Scope
- Repo-specific instructions are child context under the active project memory.
- Do not create a separate primary private memory source inside this repo unless explicitly requested.

## Change Discipline
- Preserve browser-first behavior and the `tab` / `thread` / `session` split.
- Prefer main-process ownership for persisted runtime state.
- Run `npm run acceptance` for meaningful code changes.
