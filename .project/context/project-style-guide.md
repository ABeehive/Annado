# Project Style Guide

## Naming

- Delano project slugs use kebab case, e.g. `annado-windows-compatible`.
- React components use PascalCase; hooks use `useX`; Zustand slices stay under `src/stores/slices`.
- Rust command payloads use serde `camelCase` for frontend-facing fields.

## Code Style

- TypeScript is strict. Prefix intentionally unused values with `_`.
- Prettier uses single quotes, semicolons, 100 column print width, and ES5 trailing commas.
- Keep imports relative; there is no configured source alias.
- Prefer existing Zustand slices, Tauri command patterns, and local UI conventions before adding new
  abstractions.
- Keep comments sparse and useful.

## Documentation Conventions

- Keep context factual and concise. State uncertainty instead of filling gaps.
- Use relative repo paths in committed docs.
- Update `.project/context/` when architecture, scope, constraints, testing policy, or active
  delivery state changes.
- Record task evidence in Delano updates/tasks rather than in broad context files.

## Review Expectations

Verification should match risk: focused Vitest for frontend utilities/components, Rust tests for
parser/vault/native behavior, and manual Tauri smoke tests for desktop workflows. For Delano
contracts, run `delano validate`.
