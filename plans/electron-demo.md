# Electron demo

Status: implementing. Related issues: none.
Owners: docs/managed-workspace-runtime.md, docs/inbox-content.md, docs/testing.md.

Provide a development-only native demo entry using shared browser fixtures. It
uses the production window construction, preload, app protocol and child IPC,
but never starts Alice, UTA, Connector or an agent. Every launch owns a fresh
temporary profile and mock state. Mock UI assets have a separate output folder.
The data adds a coherent AI data-center power research story while preserving
existing coverage fixtures. No new responsive layout or interaction primitive
is introduced; existing keyboard, reduced-motion and accessibility behavior stays
owned by the shared UI.

- [x] Share native window construction and add isolated demo launcher/backend.
- [x] Add coherent report, conversation, Inbox and recurring follow-up data.
- [ ] Verify contracts, typechecks, full suite, browser and native surfaces.
- [ ] Document usage/limits and deliver through the serial dev PR workflow.

Acceptance: one command opens a real app:// Electron window with useful mock
content, file previews and native chrome. No live services or user state are
used. Real agent execution and harness processes remain outside demo coverage.

Native demo, browser walkthrough, normal PTY smoke and unsigned packaged
Workspace acceptance passed. Root/UI/desktop types pass. Full regression is
being repeated after repairing same-day Office fixture identity.
