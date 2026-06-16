# Product Context

## Users

Primary users are people who keep tasks in Obsidian or Markdown and want a native task manager
without moving data into a proprietary database. Maintainers need confidence that Annado edits the
right lines in user files and does not corrupt vault content.

## Core Flows

- Select a vault and scan Markdown tasks.
- Capture tasks through Quick Add, including date hints and inline metadata.
- Review and edit tasks across Inbox, Today, Upcoming, Anytime, Someday, Logbook, Recurring,
  Agenda, Review, Wrapped, Smart Lists, project/person/tag views, and side panel.
- Persist edits directly to Markdown.
- Reflect external file changes through the watcher.
- Use Obsidian-style projects, people, tags, daily notes, and wikilinks.
- Schedule work in Agenda with durations, time blocks, work hours, and calendar blocking where
  available.

## Product Constraints

- No proprietary task database should become the source of truth.
- Obsidian compatibility matters, but the app should also work on ordinary Markdown folders.
- macOS Calendar integration is currently native and Apple-specific.
- Windows support must start with honest core workflow compatibility before making claims about
  Calendar, tray, notifications, shortcuts, or deep links.
