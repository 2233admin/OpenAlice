# Alice desktop companion

Status: implementation complete; native and packaged acceptance in progress.
Related issues: none. User requested a native macOS/Windows companion using
their two PNGs and the Whale Widget interaction model.

Owners: docs/desktop-companion.md, docs/managed-workspace-runtime.md,
docs/testing.md, docs/development-workflow.md.

Decisions: one companion renderer owned by the existing Electron process;
start with the main window, remain visible on minimize, destroy on owner close.
Use upstream press/release/mirror/bubble timings and default snap zones. Native
menus and tray own visibility/size; static PNGs retain user artwork. Decorative
speech is not runtime status. Keep local-only IPC and packaged resource checks.

- [x] Character/bubble assets, MIT attribution, press and bubble animation.
- [x] Native window lifecycle, click-through, drag/snap, tray, size/persistence.
- [x] Geometry tests and isolated real-Electron interaction smoke.
- [x] macOS demo startup and main UI regression smoke.
- [x] Full hermetic suite: 808 files, 7103 passing tests, 4 skipped; desktop/root/UI typechecks.
- [x] Unsigned packaged Workspace acceptance with companion resources.
- [ ] Windows native interaction smoke in Desktop Package Smoke workflow.
- [ ] Review final diff, integrate through dev PR, leave reviewable preview.

Completion: all available automated gates pass; actual evidence and any remaining
physical multi-monitor/manual Windows limitations are reported explicitly.
