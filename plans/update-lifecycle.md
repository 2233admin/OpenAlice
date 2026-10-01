# Update lifecycle

Status: active implementation. Centralization direction accepted; shared release
selection is implemented, with inventory and lifecycle migration still open. Related issues: none linked; findings remain
in this workstream. Owner guides: [[docs/alice-project.md]],
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

Historical audit; the active migration below supersedes its implementation
sequence. Individual findings must be rechecked during migration. Baseline: `origin/dev` at `f1ce0ef1`.
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

### Active migration: one lifecycle, real and simulated adapters

Planning baseline: `origin/dev` at `07ec71b3` (2026-09-29). The current
rehearsal shares discovery request handling and some version comparison, not
production planning or execution lifecycle. Its seeded version-order rules
must not silently become production compatibility policy.

#### Ownership and public entry

Introduce a browser-safe shared `packages/update-lifecycle` core for identities,
release selection, dependency planning and operation transitions. Node adapters
own effects; one public `useUpdateLifecycle` facade projects snapshots and
commands into React. Do not make React responsible for SSH, durable operations,
background policy, or restarting its own host.

- Separated mode: the local relay owns coordinated client/backend operations.
- Integrated Electron: the desktop main/control plane owns the same coordinator
  contract, with IPC and the native updater as adapters.
- Each backend owns project-local execution, serialization and durable receipts.
  Automatic Workspace work and non-GUI commands enter that same project service.
  A relay delegates a child operation with an idempotency key and reconciles its
  receipt; it does not create a competing Workspace scheduler.
- Uniqueness means one implementation and one authoritative operation per scope,
  not a fictitious global singleton spanning unrelated machines. Different
  relays must still serialize through the target installation/project owner.
- Existing connection lifecycle owns transport health and target generation.
  Update management consumes that evidence; it does not add another heartbeat
  or take over Machine profile CRUD and ordinary connection switching.

The simulator instantiates the same coordinator with an in-memory journal,
virtual clock, mock release catalog and fake owner adapters. It must not carry
its own plan/approval/retry/dependency rules. Its publisher remains a fixture
producer following release contracts; signing and actual publication stay in CI.

#### Inventory, probing and operation contract

Inventory records installation identity separately from project and process
roles. Every entry distinguishes installed, active and desired release, source,
channel, capability and policy scope. Bundled components update as one unit;
Chat assets follow the backend's delivered template, while AQ/AP resolve their
independent upstream stable tags. Skills and Broker Packs retain their owners.

All version discovery enters one command. Backend/SSH probe implementations
return evidence to the manager; components cannot start their own update polls.
Use bounded concurrency, timeout, single-flight and metadata caching keyed by
installation, project where relevant, platform/architecture, channel and source.
A target-generation change prevents late responses updating the new selection.
Catalog freshness and runtime health have separate timestamps; apply always
revalidates the target and review fingerprint rather than trusting a cached probe.
An unavailable probe reports unknown/stale/error, never a fabricated current state.

A check is read-only with respect to installations and Workspace content.
Automatic application is a separate policy command following discovery. Turning
off auto-apply does not turn off discovery. Preserve approved defaults for
asynchronous preparation and safe automatic AQ/AP stable updates.

Commands cover check, create plan, approve, execute, retry/resume and policy
changes. Plans freeze exact artifacts/commits, scope and prerequisite edges;
approval becomes stale when relevant evidence changes. New publication during
execution cannot change the approved target. Distinguish approval waiting,
safety blocking and execution failure.

Journal the operation before mutation and before replacing its owner process.
Record completed stages, child receipt IDs, exact-target verification and
structured recovery actions without secrets. Installation success followed by
reconnect failure retries verification/reconnection, not installation. After a
crash, reconcile unknown outcomes with owner evidence before repeating effects.
Client restart recovery is locally durable and must not depend solely on the
backend being upgraded. Existing atomic install, merge, activity and integrity
guards remain authoritative; this is not a replacement installer.

#### Migration and retirement map

| Existing implementation | Destination / retirement |
| --- | --- |
| `ui/src/hooks/useUpdateLifecycle.tsx` | Keep the public name; replace component-owned orchestration with the shared coordinator projection |
| `ui/src/hooks/useVersionDiscovery.ts` | Move request generation/single-flight behavior into shared discovery; retire the separate public lifecycle hook |
| `ui/src/lib/updates/discovery.ts`, server/CLI release comparison | Consolidate shared identity/channel/selection rules; keep format-specific feed parsers in adapters |
| `ui/src/hooks/useMachineManagement.ts` | Move upgrade probe, plan, operation and polling into lifecycle; retain non-update Machine administration in its owner |
| `DesktopUpdatePrompt` and native status subscriptions | Subscribe through the facade; retain only presentation state such as dialog visibility |
| `src/webui/routes/updates.ts`, `WorkspaceAutoUpdates.check()` | Thin project-service commands; separate observe from policy apply and remove mixed check/apply behavior |
| `packages/cli/src/machine-management.ts` | Adapter to coordinated plans and durable operations; preserve fingerprint, expiry, consent and serialization guards |
| `useUpgradeRehearsal.ts`, rehearsal `model.ts` | Keep scenario fixtures and interaction bindings; delete duplicate lifecycle reducer/planner/retry rules as each shared slice lands |
| Desktop native updater, CLI installer, template/source engines | Retain effect ownership; normalize progress/receipts and require the common lifecycle entry |

Do not preserve old hooks or executable aliases as compatibility wrappers.
Migrate all callers of each replaced slice in the same increment and remove it.
Transport compatibility for already shipped runtimes is capability-based and
explicit; it must not resurrect a second lifecycle. Establish shipped persistence
boundaries before adding migrations; replace unreleased shapes directly.

#### Ordered implementation and acceptance

- [ ] **1. Shared identity and inventory.** Establish installation/role identity,
  release/artifact/provenance separation, stable/beta/commit selection and
  explicit compatibility evidence. Move comparison/selection into the core;
  connect real discovery and the simulator in the same increment. Keep existing
  mismatch cases, but distinguish supported incompatibility from unknown legacy
  capability rather than assuming every higher backend version is incompatible.
- [ ] **2. Centralized probing and facade.** Route app, relay/backend and project
  observations through scoped discovery. Remove duplicate hooks, subscriptions
  and polling; separate checks from automatic apply and repair preference scope.
  Prove two UI consumers share one check, switching targets rejects stale results,
  disabling auto-apply still discovers, and cached availability survives a failed
  refresh with its freshness/error visible.
- [ ] **3. Shared planner and rehearsal.** Use the same dependency graph, immutable
  approval, blockers and transition logic in product review and simulation.
  Replace the rehearsal-specific lifecycle. Cover frontend ahead/behind, explicit
  backend-only incompatibility, backend-to-Chat ordering, busy Workspace and
  stable/beta/commit publication after approval. Compare plans and event traces
  under identical evidence, rather than testing two independent implementations.
- [ ] **4. Durable execution and recovery.** Adapt remote CLI and native desktop
  execution to receipts, exact-target checks and restart recovery. Fix the original
  official-package identity mismatch within these contracts. Exercise installed
  versus active mismatch, lost response, backend restart, relay restart, browser
  reload and desktop restart. Retry only the unfinished safe stage; require an
  explicit recovery outcome when rollback or replay cannot be proved safe.
- [ ] **5. Complete project coverage and retire bypasses.** Route Chat, AQ/AP,
  injected skills and Broker Pack update intents through their authoritative
  services and the common inventory. Preserve merge/ABI/activity safeguards and
  optional UTA behavior. Move shared version/state tests to the core; retain
  transport and installer-specific tests beside their engines. Remove remaining
  bypass calls, document the public contract in owner guides and accept all
  affected real surfaces.

Each increment must pair a real consumer with rehearsal coverage. Do not finish
an isolated simulator first and postpone product integration. Temporary progress
is tracked here; it is not permission to keep two final public entry systems.
No production install, restart, publication or automated upgrade is authorized
merely by running a rehearsal.

Final acceptance includes source-level caller audit, shared contract tests and
real browser relay plus unsigned packaged Electron integrated/separated flows.
Use an explicitly selected remote test target for installation acceptance, never
live trading state. Demonstrate reload recovery and concurrent-client protection.
A green simulator proves lifecycle decisions, not native installation or SSH.
UI layout changes need their own proportional design alignment; this migration
preserves the existing rehearsal interaction while replacing its implementation.

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

## 2026-09-29 channel publication and shared discovery increment

Selected interaction: add a compact publication card above the existing consumer
flow. Choose stable, beta or dev; build the next candidate, verify it, publish
immutable artifacts, then activate only that channel head. Consumers select their
own channel and check for updates. Publication remains available during an
approved run; its target and consumed artifacts remain frozen. Completing a run
allows another update without resetting installed versions or release history.
Native selects and shared Button/Collapsible retain keyboard support; lists wrap
and stack at narrow widths. This is an extension of the accepted reference layout.

Actual reuse in this increment:
- `useVersionDiscovery` owns loading/error state, latest-request selection and
  scope invalidation. Both the production `useUpdateLifecycle` provider and
  rehearsal invoke it with their own readers. Stale results or callbacks from a
  previous backend/channel cannot replace a newer result.
- The existing UI release comparison moved into `lib/updates/discovery.ts`; the
  real client update badge and mock release selection use the same comparison.
  Dev selection compares accepted commit identity, not lexical SHA ordering.
- Production transport, server-side version authority, native updater and actual
  installation/restart remain unchanged. `/api/version` does not expose dev
  commit identity; this increment does not pretend that it does or replace the
  CLI owner's dev update decision with a UI guess.

Simulation publication begins at 0.94.1. Stable advances patch, beta advances
candidate numbers, dev advances a synthetic full commit with the same package
version. Stable/beta inventory derives from the captured 73-file stable snapshot
(beta omits its 12 package-manager attachments). Dev topology follows
`scripts/prepare-cli-dev-assets.mjs` and `scripts/dev-broker-binding.mjs`: six CLI
targets, six Pack catalogs, 29 Pack archives and two installers, under an immutable
commit path. Channel pointers are state, not extra immutable release attachments.
All generated builds, checks and publication are simulated, not remotely executed.

Remaining migration boundary: installation plans/execution are still the mock
reducer. Remote Machine maintenance, Electron installation, CLI commit identity
and Workspace source-update execution have not yet been unified. This is the
first shared discovery slice, not a claim that the full updater has been replaced.

Verification includes reducer publication isolation/frozen artifacts, numeric
beta and unchanged-version dev identities, production provider regression tests,
shared hook stale-request/error/retry tests, UI owner suite and UI typecheck;
real browser exercises beta isolation and dev publication/consumption. No real
update, SSH, broker activation or signed release action is performed.

## Version mismatch rehearsal cases

Add directly selectable, seeded fixtures with an active 0.94.2 release:
frontend newer (0.94.2/0.94.1), backend newer (0.94.1/0.94.2), backend upgrade
followed by its bundled Chat template, current backend with an outdated Chat
template, and busy Chat waiting after backend reconnection. Selecting a scenario
loads a fresh fixture, explicitly disclosed by the page. Publication and channel
selection remain available within each fixture.

Plans now avoid implicit SemVer downgrades. A missing matching frontend release
blocks a backend-ahead plan. Chat template identity is separate from app SemVer:
synthetic template 1/2 model a bundled managed-context update, not an AQ/AP Git
source update. Backend activation and reconnection precede template apply. Busy
Chat retains its old template and the successful backend upgrade; release resumes
only the remaining template work. The fixture does not claim to execute the
production three-way merge or replace its preview digest/conflict protections.

Validation: five mismatch behavior specs plus existing publication and hook
regressions; UI typecheck; real browser review of frontend/backend mismatches and
execution of backend-to-Chat plus busy/resume. Real installers remain untouched.

## 2026-09-29 first shared-core increment

The first slice of phase 1 introduces `@traderalice/update-lifecycle` and wires
production backend checks, CLI stable/beta/dev checks, UI badges and rehearsal
selection to it. Source Workspace tag comparison uses the same comparator.
Removed the UI discovery comparator module and server/CLI comparator exports;
shared comparison/channel tests now live in the package. Installer ownership,
legacy stable-layout refusal and checksum verification remain in their adapters.

Normal checks cannot select lower SemVer releases; an explicit CLI channel switch
remains a separate intent. Missing/invalid evidence stays unknown in the shared
decision and projects to existing transport error/unsupported fields. No new
persisted state or API schema is introduced.

Phase 1 remains open for scoped installation/active/desired inventory and
compatibility evidence. This increment does not unify probes or execute the
simulator through the real operation coordinator yet. See
[[docs/update-lifecycle.md]] for the implemented boundary.

Packaged acceptance exposed historical `snapshot-*` source catalog entries. They
remain valid exact selections; automatic SemVer selection excludes them and an
opaque installed baseline requires explicit source selection rather than guessing
its order. A Git-backed regression covers both stable discovery and exact
snapshot planning. The onboarding smoke's synchronous pre-render Chat assertion
was corrected to wait for post-render preparation. Its subsequent mock credential
verification timeout is tracked separately in GitHub issue #1657; it is not
claimed as passing onboarding acceptance.

Acceptance for this increment: root/UI/CLI/shared-package/desktop typechecks,
UI and Electron builds, the complete hermetic suite (859 passed files, 7,371
passed tests; 1 file/5 tests skipped), Git-backed source snapshot regression,
real browser mismatch and stable/dev selection flows, and unsigned packaged
Electron Workspace acceptance. Temporary packages and test process trees were
cleaned. No real remote installation, native auto-update restart or publication
was performed; those remain later adapter acceptance. Onboarding credential
verification remains the explicitly separate #1657 failure.

## 2026-09-29 shared discovery resource increment

Implemented the request/cache portion of phase 2 in
`packages/update-lifecycle/src/discovery.ts`: single-flight, separate success and
error TTLs, last-success preservation, timestamps, subscription and generation
invalidation. Backend CDN probes and both real UI/rehearsal readers now consume
this implementation. Removed `useVersionDiscovery`; the internal React binding
only subscribes and fences target lifetime. Added connection-generation guards
for project status/preference replies so late old-backend responses cannot
replace the current project's state. Native initial status reads cannot overwrite
newer native events.

This increment does not claim phase 2 complete. Native prompt subscription
consolidation, project/SSH probe orchestration, separating Workspace check from
automatic application and client/project preference authority remain next. The
rehearsal planner/executor migration stays in phase 3. No new installer or
compatibility path was introduced.

Acceptance: shared/backend/UI focused checks passed (75 cases); complete
hermetic suite passed (7379 tests, 5 skipped). Root/UI typechecks and shared
package/UI builds passed. Real browser Settings refreshed against the older
0.91.0-beta.3 backend without losing its identity; the rehearsal switched
stable -> empty dev -> stable and reviewed the correct backend-only target.
Native initial-read/event ordering was verified with an isolated IPC mock.
No native installation, remote upgrade or restart was executed in this slice.

## Goal continuation: project observation and shared UI controls

Autonomous completion now stays on `codex/unified-update-lifecycle` with one
Draft PR until the complete plan is accepted. Earlier merged increments remain
the baseline; no phase is marked complete by a narrow incremental check.

Replaced `WorkspaceAutoUpdates` with `WorkspaceUpdateService`: manual checks are
read-only and disabled auto-apply still discovers. Separate policy application
serializes with checks, revalidates policy after planning and keeps source-owner
merge guards. Policy changes trigger the project command on the backend rather
than relying on browser follow-up. Source repository metadata now uses shared
discovery state. The public facade owns native subscription/install and Machine
probe/operation polling; removed `useMachineManagement` and the separate optional
hook. UI call sites use the same provider, including desktop prompt and About.

Remaining phase-2 work includes client-scoped policy/host discovery and moving
imperative coordination behind the shared manager. Phases 1 (inventory), 3, 4
and 5 are not complete. No real installation is authorized by rehearsal work.

Current browser acceptance: the demo Settings page retains a stable upstream
AQ candidate with automatic application disabled; the native prompt preview
opens and dismisses through the shared provider. Machine controls coalesce two
consumers' apply calls and discard dismissed late probes. AQ/AP manual review
now sees the same upstream candidate even when automatic application is off.
No real native installation or remote mutation was performed.

### Exact activation evidence increment

The shared core now verifies approved release evidence independently of SemVer
ordering and provenance. Electron's startup handoff marker and the rehearsal's
client/backend verification use it: a different unapproved active version cannot
report success, and commit/hash evidence required by a target cannot be omitted.
The native marker shape is unchanged and records version evidence only. Owner
artifact validation remains authoritative; this is not a claim that durable
coordinator/recovery or full inventory migration is complete.

Acceptance for both continuation increments: 862 hermetic test files passed,
7,396 tests passed, 5 tests skipped; root/UI/Electron typechecks and complete
Electron build passed. Unsigned packaged Workspace smoke passed with temporary
state/package cleanup confirmed. Browser Settings verifies disabled automatic
apply still discovers; native prompt preview dismisses; the backend-newer
rehearsal completes through a reload at its restart checkpoint using shared
activation verification. Native installer handoff and real SSH upgrade remain
unperformed and are still required for final topic acceptance. Draft PR #1660
collects this goal; it remains unmerged and the five-phase plan remains open.

### Overview B and interaction design (maintainer-selected)

The maintainer selected three stacked App / Backend / AliceProject cards and
approved the companion detail/review/progress/recovery design. Overview now
replaces the old About and duplicated status list; update preferences disclose
inline. Settings navigation and location selection stay with their owners.
A single focus scope handles details and scope selection; backend review uses
the shared Machine update panel, native restart requires explicit review, and
Workspace file conflicts hand off to the existing merge owner after closing
Overview's dialog. Narrow layouts use one column, bounded scrolling and visible
footer actions. Installed identity is not inferred from a running version.

The UI explicitly exposes the remaining coordinator boundary: execution scopes
are approved separately until durable cross-client-restart continuation exists.
Do not call this the complete multi-target plan UI. Native/SSH installation was
not performed by visual acceptance. Recovery does not silently reapply an unknown
operation. Later phases must replace the interim scope selector with shared-core
plan selection and resumable execution, without creating another facade.

This increment passed the complete hermetic suite (864 files, 7,401 tests;
1 file and 5 tests skipped), UI/root/CLI/desktop typechecks, Electron build,
and unsigned packaged Electron Workspace smoke with temporary state and package
cleanup. Demo Settings exercised the three cards, one-dialog scope selection,
Workspace merge handoff, and a narrow App-details viewport. The browser's
admin-enforced security check prevented the final click-through of the Machine
upgrade demo dialog; its focused component tests passed, but that browser path
remains unverified. No real remote upgrade or native installer restart was run.

### Update guidance through Settings (maintainer-selected A)

The maintainer selected the continuous breadcrumb design. The one update hook
now projects actionable App, Backend and Workspace targets separately from
Workspace blockers that require attention. AQ/AP automatic work waiting only
for an active runtime stays visible as waiting, without raising the blue
update count. The avatar menu, Settings Overview row, owner cards and exact
Workspace row share that projection; the summary focuses the target row.
Opening Settings from the avatar or choosing Overview with pending work focuses
Versions & updates. Narrow Workspace rows stack version and status beneath the
name so the navigation target remains readable. This is a UI projection over
existing approvals, not a new installer or cross-restart coordinator.

Acceptance: the complete UI owner suite passed (356 files, 2,048 tests) and
UI typecheck passed. Demo Settings at a narrow desktop width and 390px mobile
width showed one Chat update across the breadcrumb, while AQ remained an
automatic wait. Keyboard entry from the avatar focused Versions & updates;
the summary focused the exact Chat row. No installation command was invoked.


## 2026-10-01 native remote activation and rehearsal convergence

Authorized after the real stable-installed/beta-running incident. The shared
comparison was correct, while SSH required exact client provenance and only
restarted in the same transaction that installed bytes. Rehearsal had a separate
planner and could not detect either production failure.

This increment carries native SSH release selection, activation-only planning,
and evidence-checked stage receipts through the shared core. The simulator uses
that core for client/backend release stages; native SSH writes private atomic
receipts and resumes the same target after controller loss. GUI updates discover
the remote installation's own channel. Existing installer, Guardian and package
manager ownership remain intact. Shared installation changes are serialized per
SSH profile on this client; remote ownership remains authoritative.

The existing review dialog keeps its interaction/focus primitives and responsive
grid. It now displays running, installed and target values rather than treating
an installed release as the active one. No new navigation or approval surface.

- [x] Reproduce stable installed / beta active in the real planner and record
  parity with a selectable rehearsal fixture.
- [x] Reuse shared target selection and stage transitions; activation without
  reinstall, owner replacement rejection, and no implicit channel downgrade.
- [x] Persist approved target/home/owner and resume installed/stopped/active
  states; include GUI relay reconnection before successful completion.
- [x] Run full hermetic/type/critical gates, real browser rehearsal and native
  SSH/Electron package acceptance; results and baseline failures recorded below.

Acceptance on macOS ARM64, with a disposable Linux ARM64 SSH host:

- Root, UI, CLI, shared-package and desktop typechecks passed. Focused production,
  rehearsal and inventory regressions passed; the complete UI owner suite passed
  (359 files / 2,063 tests). The required critical receipt
  reports `acceptance=true`.
- Full hermetic run: 884 files / 7,556 tests passed; six pre-existing fixture
  failures remain in three files (four preference-isolation failures, #1686;
  two Darwin synthetic executable failures, #1687). One file / eight tests were
  skipped. This is a recorded baseline limitation, not a green full-suite claim.
- Real browser rehearsal approved stable-installed/beta-active, reloaded after
  activation, then completed verification and reconnection with no install stage.
- Electron build, PTY smoke, unsigned packaged Workspace acceptance (all twelve
  checks), clean installer smoke and Guardian recovery smoke passed.
- The complete SSH lane passed registration, native start, inventory, relay,
  reconnect, structured stop and real TUI/project transfer. Its published-release
  extension installed `0.94.1-beta.2`, kept that process alive while installing
  `0.94.1`, activated without reinstalling, interrupted relay restoration, then
  recovered over actual SSH/HTTP without a second restart. No user remote was
  modified. Native Linux x64 remains covered by identity fixtures, not this
  machine's ARM64 artifact execution.

Real acceptance also exposed missing explicit home selection on a fresh host,
an unset-default inventory envelope rejected by its own consumer, and a dev
archive reuse error. Those are repaired here with regressions. The Docker build
now includes the pure desktop activity modules imported by the shared UI; smoke
assertions preserve the actual pre-transfer default rather than assuming one.
The GUI keeps stopped projects selectable for activation recovery. Reloading
Settings exposed a provider-mount generation race that stranded Machine
discovery in loading; a failing regression reproduced it before the fix.

This does not mark the full plan complete: native desktop self-update and
Workspace content still have owner-specific operations, and a durable operation
spanning all units remains future work. The native SSH/rehearsal slice is shared;
source-checkout preparation and explicit takeover keep their distinct contract.
