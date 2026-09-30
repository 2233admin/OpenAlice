# Product scenarios and protocol boundaries

This directory is the product evidence map. Each group owns a `coverage.json`
with required initial state, action, expected behavior, priority, specific
assertion/command references, fidelity, environment limits, and remaining gaps.
The manifests feed the existing catalog and selector; this is not another test
runner. Leaf unit/component specs stay beside their owning implementation.

## Browse and run

```bash
pnpm test:groups
pnpm test:groups --scenario desktop-lifecycle --explain
pnpm test:groups --contract alice-uta --json
pnpm test:inventory --json
pnpm test:select --scenario workspace-creation --lane integration
pnpm test:select --scenario first-run --contract alice-uta --owner alice --explain
pnpm test:select --contract ui-api
```

`--scenario` and `--contract` OR values within their own dimension and AND
with one another and the existing lane/owner/area/package/path dimensions.
Execution selects the **spec evidence referenced by requirements**, not every
test that happens to live in a related folder. The default lane remains
hermetic. Choose integration explicitly. Empty executable selections fail.

`--groups` inspects complete requirements, including rows with no test yet.
It accepts scenario/contract filters and output modes, but rejects file/lane
filters so it cannot hide a gap behind an unrelated selection. `--inventory`
is complete and unfiltered: every spec appears once, with its owner/lane and
group references, and every discovered manifest check/registered standalone
acceptance appears with its runner and prerequisites. Both modes read only
repository data and never import tests, inspect user credentials, or execute
acceptance commands.

Dedicated commands are additional evidence to obtain separately. A group's
paper, Docker, package-manager, or Electron command is never implicitly
executed by selecting that group. Established owner command namespaces remain
authoritative. Artifact builders/publication operations are not part of this
test inventory or the selector; a verification task in a publishing workflow
does not authorize invoking the entire workflow.

## Scenarios

| Group | Product behavior | Responsible owner |
| --- | --- | --- |
| [first-run](scenarios/first-run/coverage.json) | Initialization, login, and broker-free Chat | Alice |
| [workspace-creation](scenarios/workspace-creation/coverage.json) | Bootstrap, injection, and source ancestry | Runtime/CLI |
| [conversation-recovery](scenarios/conversation-recovery/coverage.json) | Interrupt, resume, and durable Session recovery | Runtime/CLI |
| [scheduling-delivery](scenarios/scheduling-delivery/coverage.json) | Occurrence claims, retries, and observable CLI side effects | Runtime/CLI |
| [trading-approval](scenarios/trading-approval/coverage.json) | Staging, approval, lifecycle, precision, and venue baseline | UTA |
| [connector-delivery](scenarios/connector-delivery/coverage.json) | Inbox projection, replay, and adapter recovery | Connector |
| [desktop-lifecycle](scenarios/desktop-lifecycle/coverage.json) | Close, Dock/tray reopen, and explicit quit | Desktop |
| [update-recovery](scenarios/update-recovery/coverage.json) | Persisted state, N-1 app/CLI artifacts, and restart | Desktop |

## Boundaries

| Group | Contract | Responsible owner |
| --- | --- | --- |
| [ui-api](contracts/ui-api/coverage.json) | UI, authenticated HTTP, request identity, and error behavior | Alice |
| [alice-uta](contracts/alice-uta/coverage.json) | Optional carrier, shared errors, and trading permissions | UTA |
| [cli-tool-gateway](contracts/cli-tool-gateway/coverage.json) | Workspace scope, strict arguments, and real socket transport | Alice |
| [guardian-process](contracts/guardian-process/coverage.json) | Runtime ownership, takeover, recovery, and cleanup | Runtime/CLI |
| [desktop-ipc](contracts/desktop-ipc/coverage.json) | Renderer/preload/main/child requests and PTY | Desktop |
| [alice-connector](contracts/alice-connector/coverage.json) | Validated claims and directed optional-service delivery | Connector |
| [persisted-state](contracts/persisted-state/coverage.json) | Shipped formats, migration journal, and Session dossiers | Alice |
| [development-workflow](contracts/development-workflow/coverage.json) | Test selection, collection, and source/publication authority | Repository tooling |
| [native-platform](contracts/native-platform/coverage.json) | Native shell arguments, toolchain, and platform evidence | Runtime/CLI |

## Interpret the matrix

- `mapped`: reviewed assertion/runner evidence is linked; no additional gap is
  recorded for that bounded requirement. It does not mean a run passed.
- `partial`: evidence exists, but the row names an unproved behavior or
  environment. A fake BrowserWindow can prove a callback while native
  close/reopen with an active Session remains partial.
- `missing`: no assertion or runner evidence is linked for the requirement.
- `unreviewed`: the behavior/evidence needs review before drawing a conclusion.
- `owner-only` in the inventory: a leaf spec is accounted for by owner/lane but
  has not been claimed as evidence for one of these product requirements.
  Do not infer that its assertions prove a full scenario, or that it has no
  value merely because it remains owner-only.

The initial matrix is a reviewed starting set of important behaviors, not an
exhaustive catalog of all product behavior or every assertion in every leaf
spec. P0/P1/P2 rank follow-up review and gap work; Stage 1 introduces no new
CI policy, native acceptance receipt, broker run, or product coverage claim.
Prioritize Stage 2 from the explicit gaps: broker-free first run, real
conversation/restart recovery, native close/reopen/quit, approval/write
idempotency, and required smoke result/cleanup semantics.

## Maintain evidence

Add a required behavior row before claiming its coverage. Reference an existing
spec by exact repo-relative path and an assertion title/unique stable fragment,
or a command by its inventory id (`<package>#<script>`; standalone ids are in
`commands.json`). State the fidelity and what its environment does and does not
prove. `review` is `reviewed` or `unreviewed`; `gap` is explicit, including an
empty string only when no additional gap has been identified for that row.

Every central spec declares its owner, lane, named areas, and optional package
association in exactly one group's `centralTests`; it must also appear in an
evidence row. This preserves package selection after moving a package-owned
integration test. Other groups may reference the same spec without claiming
its ownership. New central hermetic specs are included by their owner's Node
or UI execution environment. New central integration specs feed the existing
integration config. Adding another risk lane requires updating its dedicated
config/selection contract rather than assuming the default runner collects it.

`commands.json` records dedicated runner metadata, not copies of manifest
command strings. Root/package manifests supply those strings at query time.
Named test/smoke/verify/package-inspection commands are discovered automatically;
a new non-Vitest command needs explicit effects and prerequisites. Standalone
artifact acceptances retain their argument-bearing invocation and owning
runner. Runner discovery is intentionally explicit for standalone files:
helper libraries and arbitrary scripts are not presumed executable checks.

Run `pnpm test:contract:workflow` after changing evidence or classification.
Its integrity checks reject removed assertions/tasks, duplicate or missing
central ownership, and catalog references that drift. Collection-wide metadata
changes invalidate changed-test selection. Follow [the testing guide](../docs/testing.md)
for the full verification ladder and side-effect boundaries.

Central TypeScript specs and the catalog guard have an explicit typecheck
because the root `src/` typecheck does not include their new locations:
`pnpm exec tsc -p tests/tsconfig.json`.
