# Unified startup Default

Status: implementation. Base: dev 0f0b53c2. Delivery: one Draft PR to dev;
no merge, release, data moves, or changes to PRs #1673/#1674.

Owner guides: docs/alice-project.md, docs/cli-supervisor.md,
docs/data-locations.md, docs/remote-access.md, docs/testing.md.

## Agreed product / PRD

Users move between local and registered remote AliceProjects from Desktop,
Web or TUI. They need the next entry to open the same choice. One Default,
`{machine, project} | null`, belongs to the current machine's Supervisor root.
There is no independently synchronized Recent or implicit local CLI default.

- R1: schema 3 config.defaultTarget is the sole authority; projects is a local
  registry. null means chooser. All entry points resolve the complete pair.
- R2: a user switch saves only after health and identity verification and,
  for Desktop, replacement navigation. Failure/cancellation/close/stale work
  cannot save. Save failure leaves the live connection usable with an error.
- R3: restore, reconnect, polls, inventory, create/start/inspect do not save.
  An unavailable remote Default remains selected for recovery; healthy local
  runtimes never replace it in the background.
- R4: explicit project is local; machine plus project is remote. Home and env
  overrides apply to the invocation. `project use` explicitly sets Default.
  Remote commands receive an explicit project resolved on the origin; an
  unsupported command fails rather than running against a local fallback.
- R5: migrate once: new schema (including null) wins. Consider legacy startup
  target, mapped desktop selectedHome and old local default. Conflicting,
  malformed or unmapped inputs produce a recoverable chooser error; do not
  invent a target. Preserve unreachable choices and old files as backups.
- R6: serialize read/modify/write at the Supervisor root; atomic rename alone
  is insufficient. Preserve unrelated config and reject newer schemas.

## Interface and journey

Reuse the existing Settings location cards and startup chooser. The existing
startupDefault badge reads **Default** rather than Recent. Loading, connection
errors, saved-choice errors, keyboard/focus, responsive cards and busy controls
stay in their existing components. No layout or visual redesign is required;
the current ConnectionSection / RelayLauncher are the visual specification.
Legacy directory selection must not create a second startup policy; use the
registered project chooser for switching. Backend and CLI work has no new
visual surface, so an invented interface image is not applicable.

Restore Default -> verify attachment -> show project (no save).
User selects project -> verify attachment -> navigate where required -> save
Default. Failed or cancelled verification -> retain saved Default + show error.

## Architecture and acceptance

Supervisor config owns validation, migration and serialized persistence.
The shared startup module owns pair resolution and successful commit guards.
Relay owns verified attachment; Desktop owns its navigation success boundary.
TUI observes relay state without a second preference write. Project backends
and login do not own the client's Default.

| Requirement | Evidence to collect |
|---|---|
| R1/R4 | local/remote cross-entry, explicit override and remote-default isolation |
| R2 | health/identity/navigation failure, cancellation/late completion, save failure |
| R3 | unavailable remote plus healthy local across polls, reconnect/no writes |
| R5 | consistent/conflicting/corrupt/missing/new null/changed backup files, restart |
| R6 | concurrent config writes, unknown fields, newer schema refusal |

Checklist:
- [x] Inspect latest dev and owner guidance; record agreed PRD.
- [x] Implement shared authority and migration.
- [x] Route entry points and successful switches; remove background writes.
- [x] Focused tests, relevant typechecks, critical gate, broader full suite.
- [x] Real available surfaces; explicitly report unavailable native acceptance.
- [ ] Update owner docs; open Draft PR and record exact-head CI.

## Verification record

- Focused selection/config/UI suite: 169 passed; root, CLI, UI and Desktop
  typechecks, Desktop relay bundle build; critical gate 11/11 accepted.
- Chromium demo Settings route exercised using existing visual language.
- Full suite: 7,398 passed, 5 failed tests plus native PTY suite load failure.
  Four failures reproduced on dev in unaffected process-cleanup/installer
  tests. npm packing passed with a writable npm cache. Native PTY/Electron
  downloads failed in this Linux environment; unsigned native launcher,
  Mac/Windows restart and packaged Git acceptance remain CI/manual gates.
- Local critical/full runs used system Git via LOCAL_GIT_DIRECTORY=/usr,
  GIT_EXEC_PATH=/usr/lib/git-core, not bundled dugite Git.
