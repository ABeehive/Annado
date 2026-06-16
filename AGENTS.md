# Repository Guidelines

## Mission

Annado is a macOS-focused Tauri 2 task manager for Markdown and Obsidian vault tasks. Preserve the
plain-file data model, follow the existing React/Rust patterns, use Delano when delivery state
matters, and prove changes with focused checks.

## First-Turn Workflow

1. Inspect `git status --short --branch` so user changes are visible before editing.
2. If Delano project state might matter, run `delano status --open --brief` and read the matching
   `.project` contract; if no project exists, use normal repo context.
3. Read only the source of truth needed for the change.
4. Prefer current code and active contracts over stale plans or memory.
5. Make the smallest coherent change, verify it, then report done, partial, or blocked.
6. Update Delano contracts or progress only when scope, status, architecture, acceptance, or
   evidence changed.

## Sources Of Truth

`AGENTS.md` defines first-turn behavior and safety. `HANDBOOK.md` defines the Delano delivery model,
lifecycle rules, evidence expectations, and CLI semantics. `.project/context/` is project memory;
`.project/projects/<slug>/` holds active specs, plans, decisions, workstreams, tasks, and updates.
`.agents/` holds Delano skills, rules, schemas, hooks, scripts, logs, and adapters. `.delano/` is a
viewer/presentation layer, not process truth.

For product behavior, read `README.md` and `docs/`. For dependency truth, use `package.json` and
`src-tauri/Cargo.toml`.

## Retrieval Index

- Delano workflow -> `HANDBOOK.md` and `.agents/skills/*/SKILL.md`
- Active scope or evidence -> `.project/projects/<slug>/`
- Project memory -> `.project/context/`
- Frontend -> `src/components`, `src/features`, `src/stores`, `src/utils`
- Backend/native -> `src-tauri/src`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`
- Product docs -> `README.md` and `docs/`

## Delano Workflow

Use Delano for features, unclear work, contract changes, or material improvements. The flow is:
Discovery, optional Prototype Probe, Planning, Breakdown, Synchronization, Execution, Quality Ops,
and Closeout. Keep this state in `.project`, with evidence in updates before closure.

Use `delano status --open --brief` to inspect active work, `delano next` to find candidate tasks,
`delano project|workstream|task` to create or patch contracts, `delano update add` for progress
evidence, and `delano validate` after contract changes. `delano onboarding` reviews this file;
`delano viewer` opens the read-only project UI; `delano install` refreshes the runtime and should be
treated as a dependency/runtime update with a reviewed diff.

For small local fixes, do not create Delano contracts unless the change affects delivery state.

## Commands

- Install dependencies: `npm install`
- Frontend dev server: `npm run dev`
- Tauri dev app: `npm run tauri -- dev`
- Frontend build: `npm run build`
- Frontend tests: `npm run test`
- Frontend lint: `npm run lint`
- Full project check: `npm run check`
- Rust tests: `cargo test --manifest-path src-tauri/Cargo.toml`
- Rust check: `cargo check --manifest-path src-tauri/Cargo.toml`

## High-Impact Constraints

- Branch policy: stay on the current branch unless the user asks for branch operations.
- Approval boundaries: no destructive filesystem/git commands, force-pushes, deploys, publishing, or
  remote tracker writes without explicit approval.
- Privacy rule: keep logs and committed docs safe; avoid local absolute paths unless intentionally
  documented.
- Runtime assumption: supported desktop runtime is macOS Tauri 2. Windows/Linux builds fail as-is
  because of Apple `EventKit`/`Foundation`, `objc2`/`block2`, and macOS `open` usage.
- Data model: tasks live in user-owned Markdown. Preserve checkbox syntax, Annado inline metadata,
  notes indentation, and Obsidian wikilinks.
- Style rules: TypeScript is strict. Use `.prettierrc`, relative imports, existing Zustand slices,
  Tauri command patterns, and local UI conventions.
- Delivery state: `.project` is Delano execution truth; `.delano` is presentation only.

## Verification

For frontend-only changes, run the relevant Vitest tests first, then `npm run lint` or
`npm run build` as risk warrants. For parser, vault, command, recurring-task, or calendar changes,
run `cargo test --manifest-path src-tauri/Cargo.toml` on macOS if possible. For Delano contract
changes, run `delano validate`.

On Windows, `cargo check --manifest-path src-tauri/Cargo.toml` is expected to fail until Apple-only
backend code is target-gated. If a check is skipped, say why. Do not update screenshots or docs
unless behavior or user-facing UI changed.
