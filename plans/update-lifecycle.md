# Update lifecycle

Status: active. Owner guides: [[docs/alice-project.md]],
[[docs/harness-web-surfaces.md]], [[docs/workspace-template-upgrade.md]],
[[docs/local-runtime.md]], and [[docs/ui-interaction-and-motion.md]].

## Product decision

Opening the app activates preparation of its default Chat, Auto Quant, and
Auto Prediction Workspaces. New projects select all three. Preparation begins
after the first rendered frames, and
failures remain visible and retryable. No Agent or Studio is started.

The app checks for updates automatically and shows one small blue indicator by
Alice’s Settings when an actionable update exists. Settings gives the complete
status for this client, the selected backend, and individual Workspaces. A
single frontend lifecycle hook owns discovery state, refresh, and selection;
the existing owner-specific updater performs each action. The hook never
applies a Workspace merge or restarts the Runtime itself.

Auto Quant and Auto Prediction default to automatic source upgrades to their
upstream repositories' newest stable SemVer tags when safe. This explicit
product preference expands automatic updates beyond OpenAlice's verified
catalog; the UI and audit log continue to distinguish unverified upstream
releases.
The existing operation guard, active-runtime check, clean merge, manifest
validation, and transaction recovery remain authoritative. Blocked upgrades
surface a reason and wait for user action.

## Sequence

- [x] Start default Workspace preparation asynchronously after first UI paint;
      make retries durable and keep startup usable.
- [x] Add backend-owned preferences and a bounded, cached scan for app and
      Workspace updates; auto-apply safe AQ/AP updates per trust policy.
- [x] Add a shared frontend update lifecycle hook, Settings status, and a
      responsive, accessible Settings indicator.
- [x] Update owner guides, demo API, and proportional tests; inspect the real
      browser route and packaged startup behavior.

## Acceptance

Fresh and existing projects with no default Workspaces prepare them after
startup without delaying page readiness. Existing selected defaults are
retained. An unavailable source cannot block startup; retry is visible. UI
navigation remains responsive while update checks run. The Settings indicator
appears only for actionable updates, including AQ/AP, and clearing an update
removes it. Automatic AQ/AP apply never bypasses the source-upgrade safety
checks or forces a merge into an active Workspace.

## 2026-09-28 semantic audit and proposed next phase

Status: audit complete; the following architecture is proposed for maintainer
alignment, not implemented or accepted. Baseline: `origin/dev` at `f1ce0ef1`.
Related issues: none linked yet; findings below remain in this change's scope.
Additional owner guides: [[docs/remote-access.md]],
[[docs/managed-workspace-runtime.md]], [[docs/cli-installer.md]],
[[docs/cli-package-managers.md]], [[docs/alice-harness.md]],
[[docs/broker-packs.md]], and [[docs/testing.md]].

The checked sequence above records the earlier delivery. It does not imply
that the broader update system already has the contract proposed below.

### Update units and authority

A frontend/backend role is not necessarily an independently installed unit.
Always distinguish the installation being changed from the processes and
projects using it.

| Unit | Authority and scope | Meaning of completion |
| --- | --- | --- |
| Electron app | Local native updater; package contains renderer, relay and bundled local runtime | Intended desktop release launched; required local services ready |
| CLI distribution | Direct installer or owning package manager; installation on one machine | Intended artifact installed; affected managed runtimes activated and verified separately |
| Browser UI | Assets supplied by its frontend host/relay, not an independently installed browser package | Host serves intended assets and browser activates them; dev HMR is separate |
| Remote backend | Remote installation owner plus selected Runtime/Guardian; relay orchestrates | Selected backend runs intended release and transport/capability checks pass |
| Chat managed template | Workspace template engine | Reviewed managed files and baseline committed; user files preserved |
| AQ/AP source | Workspace source-upgrade engine | Exact upstream commit merged and receipt recorded; this alone does not prove Studio readiness |
| Injected Alice skills | Alice Harness catalog and per-Workspace upgrade engine | Selected copied assets and baselines updated; live CLI implementation remains backend-owned |
| Broker Packs | Pack installer and UTA lifecycle | Compatible pack activated and UTA loads it successfully |
| Data migrations | Backend activation and migration framework | Required migrations succeed before readiness; binary rollback does not imply data rollback |
| External Agent CLIs, Docker, source checkouts | Existing external owner | Report capability/instructions; no implicit takeover by a generic updater |

Initialization creates a missing installation/Workspace. Update changes an
existing one. Repair, channel changes, pinning, explicit downgrade, activation,
and reconnection are distinct intents. A normal connection must not silently
mean “replace this machine's installation with my version.”

### Findings grounded in current code

1. `packages/cli/src/remote.mjs` uses local install identity to construct the
   remote install plan and `remoteCliMatchesRelease` to verify it.
   `packages/cli/src/install-source.mjs` includes selector and installer URL in
   equality. This mixes release identity, provenance, artifact integrity and
   client compatibility. The observed official Electron failure is the
   stable fallback `branch: master` versus installed `version: v0.94.1` case.
   The current mismatch predicate also has no newer-version ordering guard;
   an explicitly approved alignment plan can replace a newer remote release.
2. `scripts/build-desktop-relay.mjs` injects a CLI build version without a
   complete desktop release descriptor. A bundled relay is present; lack of a
   separately installed CLI executable is not the identified failure.
3. `packages/cli/src/machine-management.ts` stores plans/operation progress in
   memory. `packages/cli/src/web-relay.ts` reconnects after apply, but a
   reconnect failure makes the whole operation failed even when installation
   succeeded. There is no durable coordinated desktop/remote resume plan.
4. `src/webui/routes/updates.ts` POST `/check` calls
   `WorkspaceAutoUpdates.check()`, which discovers AND applies source upgrades
   in `src/workspaces/workspace-auto-updates.ts`. Disabling automatic apply
   also skips discovery. Separate the commands while preserving the approved
   default AQ/AP automatic-update policy.
5. `src/core/update-preferences.ts` stores preferences in the selected
   AliceProject. `ui/src/hooks/useUpdateLifecycle.tsx` uses that backend's
   `autoCheckApp` to invoke the local Electron updater, and uses backend
   release information to infer frontend availability. Client policy/channel
   must not accidentally follow the selected remote project.
6. `src/core/version.ts`, the frontend hook/Settings section, and
   `packages/cli/src/update.mjs` perform separate release comparisons and
   discovery. `/api/version` describes the backend; it cannot stand in for
   the local renderer/relay distribution in separated mode.
7. `apps/desktop/src/auto-update.ts` does not project checking/current states;
   `update-not-available` only logs. `update-attempt.ts` treats a version
   different from the initiating version as success, rather than confirming
   the recorded target. Native handoff evidence needs a precise completion
   contract, while retaining the existing platform updater.
8. Template/source engines already have plan digests, activity guards,
   transaction recovery and Git preservation. CLI activation already has
   immutable artifacts and rollback mechanisms. Broker Packs already have
   ABI compatibility and atomic activation. Reuse these engines.
9. The unified UI does not inventory injected skills or Broker Pack
   reconciliation. Workspace source completion does not establish dependency
   or Studio health. Do not label all of these simply “up to date.”

This is a source audit plus the previously observed packaged identity failure,
not a new end-to-end upgrade test. No remote install/restart was performed.

### Proposed common contract

Each target reports a stable identity, location, owner, installation scope,
affected consumers, channel/pin/trust policy, supported operations, and
separate installed, active and desired identities. Release identity identifies
version/channel/repository (and immutable commit for development); artifact
identity adds platform/architecture/hash. Provenance is recorded separately.
Integrity checks remain strict; compatibility uses declared protocol/schema
capabilities rather than whole-product version equality. Unknown compatibility
is explicit and cannot be invented for a legacy backend.

Discovery is read-only with respect to product installation and Workspace
contents. It may refresh bounded metadata caches. Its states are unknown,
checking, current, available, unsupported and error. A cached available release
and a failed refresh can coexist with timestamps; failure is never “current.”

An operation has an immutable reviewed target and affected scope. It records
planning, approval/blockers, download/preparation, install/apply, activation,
verification and terminal outcome. Owners omit inapplicable stages. Persist
completed stages and structured failure/retry information so “installed but
activation failed” survives UI closure and is not retried as a blind reinstall.
No simulated percentage for steps with no measurable progress.

Owner-specific services remain authoritative. A thin coordinator composes
plans and their dependencies; the React hook subscribes to snapshots and
invokes commands. It must not become a browser-owned execution engine.
Machine control operations live in the relay/Electron control plane; backend
Workspace operations remain backend-owned. Persist orchestration before
replacing a process that owns it, and reconcile owner journals on resume.
Credentials never enter an operation journal.

Policies have explicit scopes:

- Client installation: app/relay discovery and native download/restart policy.
- Machine installation: channel, pin and installer authority.
- AliceProject/Workspace: initialization and source/template automatic apply.
- Broker Pack: UTA/pack compatibility and activation policy.

Keep approved defaults: asynchronous initialization after app readiness,
automatic app discovery/notification, and safe AQ/AP newest stable upstream
tag application including visibly unverified tags. App discovery does not
imply permission to restart the desktop or remote backend. Turning off
Workspace automatic apply still permits read-only discovery. Do not add a
second independent preference for a bundled component that cannot update alone.

### Coordinated updates and UX

“Update OpenAlice” may produce a multi-target plan, not one global version.
Offer current app, selected backend and affected Workspaces with their own
installed/active/target states. Recommend a compatible release set. Backend
update does not force every client using it to update. If this client is too
old to manage the proposed backend, show a client-update prerequisite before
any remote mutation. If both directions are compatible, either side can update
independently. Plan ordering follows actual compatibility, not a universal
“always frontend first” rule.

Connection/bootstrap, repair and explicit upgrade share primitives, not an
ambiguous intent. Resolve and freeze the requested release from its owner and
channel; do not resolve a new moving “latest” halfway through apply. Explicit
downgrade/channel change needs a corresponding reviewed plan. List other
projects sharing an installation; do not automatically restart all of them.

During execution show the target, real stage and affected scope. Expected
backend restart projects an updating/reconnecting state while the local
control plane remains usable. Block conflicting actions for that target,
not unrelated Workspaces. Report partial success and offer the stage-specific
retry/recovery action. Scope Settings indicators to actionable updates; show
checks/errors separately. Use existing dialog and motion primitives when the
visual interaction is designed with the maintainer.

Do not promise universal rollback. Native binaries, Git source transactions,
Broker Pack pointers and data migrations have different recovery guarantees.
Automatic migration failure blocks readiness; never silently downgrade data.
Workspace update verification must not auto-start an Agent or Studio merely
to manufacture a success signal. Optional UTA failure must not disable Chat.

### Ordered implementation proposal

- [ ] P0: Correct packaged release identity and remote target verification;
      retain integrity checks, precise installed/active diagnostics, and
      verify the original official-package failure without blind retries.
- [ ] P1: Define target identity, discovery, operation and compatibility
      contracts. Separate read-only check from automatic apply and repair
      preference ownership. Consolidate comparison/catalog rules where shared,
      preserving native feeds and external installer ownership.
- [ ] P2: Adapt native desktop, CLI and remote operations to durable progress,
      exact-target completion and restart/reconnect recovery. Add dependency
      planning for client/backend updates and explicit downgrade semantics.
- [ ] P3: Project Workspace templates, source updates, injected skills and
      Broker Packs through the same inventory; preserve their transaction
      engines and activity/permission rules. Distinguish source applied from
      runtime ready.
- [ ] P4: Align Settings discovery, review, progress and recovery UI with the
      inventory; update owner guides/demo contracts and complete surface
      acceptance. Retire duplicated public entry logic after callers migrate.

### Verification and completion criteria for implementation

Use owner-selected tests and typechecks per delivery increment; cross-owner
implementation requires the repository's full hermetic gate. This document
change does not claim those gates were run.

Required scenarios include same-version stable selector differences; invalid
artifact integrity; a newer remote with an older compatible client; genuinely
incompatible clients; independent beta/stable channels; package-manager-owned
installs; relay/browser reload and Electron restart during an operation;
installed target with old runtime still active; successful install followed by
failed reconnect; unavailable release metadata; disabled auto-apply with
available updates; remote project switches preserving client preferences;
dirty/busy Workspace guards; interrupted source merge; migration failure; and
optional Broker Pack/UTA failure without blocking non-trading use.

Exercise real browser relay mode, packaged Electron integrated/separated
modes, and an explicitly selected remote test installation. Do not use live
trading state for update acceptance. Completion requires accurate owner,
installed/active/desired identities, scoped recovery after interruption,
preserved existing transaction safety, documented external-owner limitations,
and real-surface evidence for the originally reported packaged failure.

## 2026-09-29 embedded rehearsal surface

Maintainer requested replacing the standalone visualization with a native
Settings / Developer page, guided by an AI-generated reference. Implemented
`/settings/developer/upgrade-rehearsal`: Scenario → Review plan → Rehearse.
The selected design keeps environment and execution order side by side on
wide screens, stacks them on narrow screens, and keeps the action bar sticky.
Shared Button and Collapsible primitives retain keyboard/focus and motion behavior.

This is isolated simulation state, not a production updater. A pure reducer
owns approval, installed/active versions, app restart checkpoints, reconnect
retry, and busy-workspace blocking. A tab-scoped hook persists validated commands
and replays the reducer after reload. No real updater or SSH API is called.

The page embeds the complete 73-attachment v0.94.1 inventory captured from its
GitHub release. Fictional 1.x plans explicitly reuse that topology. The first
native UI models stable macOS ARM64 app + Linux x64 backend and integrated
Electron. Beta/dev publication, other target selection, broker activation and
unknown outcomes remain in the earlier standalone rehearsal and are not yet
ported into the guided UI; the page discloses this scope. The original standalone
artifact remains available as a reference, not an iframe dependency.

Acceptance: UI typecheck; focused reducer, hook and Developer navigation tests;
real app route against the existing local backend. Browser walk verifies review,
approval, staged install, reload at restart, resume and completion. All simulation
version values and proposed compatibility rules are labelled as assumptions.
