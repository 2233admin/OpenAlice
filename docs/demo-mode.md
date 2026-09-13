# Demo mode

Use demo mode to inspect populated frontend states without configuring a
provider, broker, or coding agent. Browser and Electron share
`ui/src/demo/handlers/` and `ui/src/demo/fixtures/`.

## Native Electron

After `pnpm install`, run from the repository root:

```bash
pnpm electron:demo
```

This builds the desktop shell and a separate mock UI, then opens Inbox in a
1280 × 800 native window without the public browser demo banner. `pnpm electron:demo --skip-build` reopens the previous
build. After source changes, run the command without `--skip-build`. Close the
window to stop its fixture child. Every launch starts fresh; the printed
`openalice-demo-*` temporary directory retains local diagnostics for inspection.

The featured story is **AI power: from demand to delivery**: Inbox research and
risk checklist, a multi-turn Chat conversation, and the recurring Morning movers
scan under Issues. Existing market, trading and edge-case fixtures remain.
Research figures are illustrative, not live data.

## What this validates

The demo uses the same window factory, native chrome, preload and file IPC as
the normal desktop. Requests traverse `app://` → Electron main → child IPC.
The child resolves shared MSW handlers directly; no Service Worker or localhost
backend substitutes for the native transport. Workspace files are seeded into
the temporary home so native file reads remain real filesystem operations.

The entry is development-only. It does not start the production Guardian,
Alice, UTA, Connector or agent CLIs. Electron profile, Workspace root and global
state are isolated, with no provider credentials passed to the fixture child.
Data-home switching and updates are disabled. Unmocked APIs return 501 rather
than reaching a live backend. UI analytics are disabled in the native demo.

Web replies remain simulated; TUI placeholders and unavailable Harness Studios
are unchanged. This mode checks rendering and desktop integration, not live
agent execution, broker behavior, packaging, or recorder cursor compatibility.
For those, use the normal Electron acceptance lanes.

## Browser and checks

```bash
pnpm -F open-alice-ui dev:demo
pnpm electron:smoke:demo
```

The browser uses MSW's Service Worker. The native smoke checks the app protocol,
preload, renderer isolation, absence of a Service Worker, Inbox-to-conversation
links, agreement between report API and native file reads, path containment,
unknown-route failure and React mounting. `--skip-build` is supported after a
successful demo build.

Native mock assets live in `ui/dist-demo/` and `dist/demo/`; normal `ui/dist/`
remains separate. Add reusable scenarios to the shared fixtures and preserve
cross-links between Workspace, Session, Inbox, Issue, run and file identifiers.

Session names, agents and initial runtime settings belong to the shared Workspace
Session fixtures. The resume directory and Issue owner projection derive from
those records; runtime edits use the same in-memory override map. Avoid adding
an Issue-specific copy of a Session or a hardcoded workspace resume response.
Auto Quant includes three assignable research Sessions; the missing CPI owner
remains an intentional recovery scenario.
