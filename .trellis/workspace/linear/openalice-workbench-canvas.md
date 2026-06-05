## Scope

Design and implement the OpenAlice workbench model beyond the first empty shell.

## Work

- Define what the workbench canvas owns: empty home, active workspace, Inbox, Tracked, and future agent artifacts.
- Decide which surfaces are tab-hosted, canvas-hosted, or sidebar-hosted.
- Make Inbox and Tracked visually obey the same shell grammar as `/`.
- Preserve URL sync and browser history behavior.
- Keep the implementation compatible with upstream i18n and existing workspace store.

## Acceptance

- `/`, `/inbox`, `/tracked`, and workspace routes feel like one product, not separate pages.
- No route regression against `UrlAdopter`.
- No persisted-state crash on old tabs.
- `pnpm -C ui build` passes.
