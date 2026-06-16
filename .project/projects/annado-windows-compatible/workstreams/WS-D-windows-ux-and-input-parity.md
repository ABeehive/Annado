---
id: WS-D
name: WS-D Windows UX And Input Parity
owner: team
status: done
created: 2026-06-16T13:37:49Z
updated: 2026-06-16T15:06:54Z
---

# Workstream: WS-D Windows UX And Input Parity

## Objective

Make the Windows app feel intentional rather than a macOS UI running under WebView2.

## Owned Files/Areas

- `src/utils/keybindings.ts`
- `src/hooks/useKeyboardHandler.ts`
- components with direct `e.metaKey` usage
- `src/App.tsx`
- `src/App.css`
- `src-tauri/tauri.conf.json`
- settings and help text that mention Cmd, macOS Calendar, or menu bar

## Dependencies

- May require platform detection from Tauri/plugin APIs.
- Should be verified after WS-A compiles on Windows.

## Risks

- Global shortcut defaults can conflict with Windows-reserved shortcuts.
- Titlebar/drag-region changes can regress macOS overlay behavior.
- WebView2 drag/drop behavior may differ from macOS.

## Handoff Criteria

- Windows labels and shortcut defaults are platform-appropriate.
- Direct hard-coded `meta` handlers are replaced or intentionally justified.
- Window chrome/titlebar spacing and drag/drop behavior are manually verified on Windows.
