---
type: research_findings
project: annado-windows-compatible
slug: windows-compatibility-audit
created: 2026-06-16T13:33:30Z
updated: 2026-06-16T13:40:00Z
---

# Findings: Windows Compatibility Audit

## Source References

- `cargo check --manifest-path src-tauri/Cargo.toml`
- `src-tauri/Cargo.toml`
- `src-tauri/src/calendar.rs`
- `src-tauri/src/commands.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/src/parser.rs`
- `src-tauri/src/vault.rs`
- `src-tauri/tauri.conf.json`
- `src/utils/obsidian.ts`
- `src/utils/openInEditor.ts`
- `src/utils/RenderTitleWithLinks.tsx`
- `src/utils/keybindings.ts`
- `src/stores/slices/calendarSlice.ts`
- `src/hooks/useKeyboardHandler.ts`
- `src/components/SettingsModal.tsx`
- `src/features/notifications/NotificationSettings.tsx`
- `README.md`
- `docs/`
- Official Tauri docs: prerequisites, Windows installer/WebView2, config, deep linking, global
  shortcut, notification, opener, and system tray pages.

## Observations

- Current Windows Rust check fails because `objc2` is compiled on Windows.
- Apple-only Calendar code is unconditional: `calendar.rs` links EventKit/Foundation and uses ObjC
  runtime/block APIs.
- `commands.rs` imports Calendar types and exposes Calendar commands unconditionally.
- `open_file_in_editor` uses macOS `open`; custom command parsing with `split_whitespace` is fragile
  for Windows paths with spaces.
- Tauri config includes macOS titlebar options; UI has macOS traffic-light padding and always-on drag
  regions.
- Tauri docs identify `titleBarStyle` as macOS-specific.
- Tauri docs note WebView2 and Microsoft C++ Build Tools as Windows prerequisites and expose installer
  WebView2 configuration options.
- Tauri docs note Windows/Linux deep links are delivered to a new process as command-line arguments
  unless single-instance routing is used.
- Tauri docs note WebView drag/drop can interfere with HTML5 drag/drop on Windows.
- Rust vault/parser code frequently splits paths with `/` and serializes absolute platform-native
  paths, which is unsafe for Windows path separators.
- Frontend Obsidian/editor helpers split paths with `/` and do not robustly encode Windows file URLs.
- Rendered Markdown links convert only POSIX-style absolute file paths to `file://` URLs; Windows
  drive-letter file links need explicit handling.
- Shortcut defaults and many direct handlers use `meta`, which maps to Windows/Super rather than
  standard Windows app shortcuts.
- UI and documentation strings say Cmd, macOS Calendar, and menu bar even when Windows is the target.

## Options Considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Stub unsupported Windows integrations first | Gets build and core workflows moving | Some feature parity delayed | Use for Calendar if provider parity is not explicitly chosen |
| Implement full Windows Calendar provider now | Better parity | Larger unknown scope | Keep as open decision |
| Normalize paths to vault-relative slash paths | Stable across OS and easier to test | Requires careful migration at command boundaries | Recommended |
| Leave shortcuts as `meta` everywhere | Minimal code | Poor Windows UX and likely conflicts | Reject |
| Claim support after `cargo check` | Fast milestone | Does not prove app launches or edits files | Reject |

## Fold-Forward Candidates

| Finding | Target Artifact | Proposed Change |
| --- | --- | --- |
| Apple-only compile blocker | `spec.md`, WS-A, T-001/T-004 | Gate deps/modules and require Windows cargo check |
| Calendar support uncertainty | `decisions.md`, WS-C, T-020 | Decide unsupported vs provider and gate UI |
| Windows path separator risks | WS-B, T-010/T-011/T-013 | Normalize and test paths |
| Editor/Obsidian/Markdown URL risks | WS-A/WS-B, T-003/T-012 | Cross-platform opener and URL tests |
| Deep-link process model | WS-C, T-021 | Add/verify single-instance deep-link handling |
| Tray/notification differences | WS-C, T-022/T-023 | Runtime verification tasks |
| Shortcut/titlebar/drag/drop issues | WS-D, T-030/T-033 | Platform-aware UI and WebView2 checks |
| Installer/WebView2 requirements | WS-E, T-040/T-044 | Configure bundle and capture artifact evidence |
| macOS-only user docs | WS-E, T-043 | Update README and docs after verified behavior is known |

## Open Questions

- Should Windows Calendar be unsupported initially or implemented through a Windows provider?
- Which Windows installer target and signing policy are required?
- Which default Windows shortcuts should replace `meta` defaults?
- Which additional compile errors appear after the current `objc2` blocker is removed?
