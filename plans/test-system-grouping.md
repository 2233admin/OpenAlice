# Test system grouping and product coverage

Status: Stage 1 accepted as PR #1667 and bounded Stage 2 accepted as PR #1672.
The lifecycle classification pilot below is a separate Draft PR increment;
native desktop, browser onboarding and real paper-venue acceptance remain open.
Audit baseline: `dev` at `b7dbe2af15626534d2784b8ccaee361bcf7e05b4` on
2026-09-30. Stage 2 incorporates notification integration at
`48cdb0f1ada301e35b32c39fefce90e87626ab83` and Stage 1's final merge into dev
at `e024be3ca40ab6fe7487889b7a3aa4f16414b15e`. The latter changes only a
plan separator relative to the already verified combined source base.
Related deferred findings: [Office navigation #1440](https://github.com/TraderAlice/OpenAlice/issues/1440)
and [PTY probe-count timing #1671](https://github.com/TraderAlice/OpenAlice/issues/1671).

Owner guides: [[docs/testing.md]], [[docs/development-workflow.md]], and
[[docs/project-structure.md]]. Read the applicable surface guide before moving
or extending its acceptance: [[docs/managed-workspace-runtime.md]],
[[docs/local-runtime.md]], [[docs/workspace-lifecycle.md]],
[[docs/workspace-issues-and-scheduling.md]], [[docs/connector-service.md]],
[[docs/uta-live-testing.md]], [[docs/cli-installer.md]], and
[[docs/remote-access.md]].

## Outcome and scope

Stage 1 makes the test system navigable and its missing evidence visible.
Stage 2 supplies and enforces evidence for the highest-risk missing behaviors.
Grouping alone does not improve assertion coverage. A passing full suite proves
only the assertions it actually executes.

The audit counted 891 spec files, of which 867 were in the default hermetic
lane, two in deterministic integration, eleven in external read-only, and
eleven in live paper. Separate system and artifact acceptance exists outside
those specs. Counts describe that snapshot, not executed cases or coverage.
Reconcile the inventory during implementation rather than freezing these
numbers as a permanent gate.

## Decisions

- Product scenarios and protocol boundaries are the navigation spine:
  `tests/scenarios/<scenario>/` and `tests/contracts/<boundary>/`.
- Keep leaf unit and component specs close to their owning code. Place genuine
  cross-module scenario and contract specs in the corresponding central
  directory, with explicit product ownership. Move existing specs incrementally
  when their assertions justify the destination.
- A group initially may reference existing tests or a dedicated acceptance
  command. Its directory must state required behaviors, evidence, and gaps;
  its mere existence never means that behavior is covered. New central specs
  must be collected and classified by the existing runner and Vitest configs.
- Extend `scripts/test-lanes.mjs` and `scripts/run-tests.mjs`; do not create a
  parallel selector or a second hand-maintained inventory of their metadata.
- Owner and side-effect lane remain independent of scenario, boundary, and
  fidelity. A task has one responsible owner and one lane; it can support
  several scenarios or boundaries. Unit, component, contract, integration, and
  acceptance describe test fidelity, not side-effect permission. Determine
  fidelity from assertions and dependencies rather than filename or runner.
- Keep `pnpm test` hermetic and retain package-local semantics. External,
  live-paper, Docker, remote, and artifact acceptance keep explicit prerequisites
  and their dedicated runners. Listing or mapping them must not execute them.
- Evidence records distinguish required behavior, existing assertion evidence,
  runtime/environment, uncovered or partial paths, and actual run results.
  A listed assertion is not a verified run; a mocked route is not an entire
  user journey; a component spec is not native platform acceptance.

## Stage 1: group and map the existing system

1. [x] Reconcile the spec inventory and manifest commands against current code.
   Include dedicated system, Electron, installer, CLI, and Broker Pack
   acceptance; record owner, lane, runner, prerequisites, and artifact/platform
   requirements. Keep publication/build commands distinguishable from checks.
2. [x] Establish meaningful directories and coverage manifests for product
   scenarios: first run and authentication; Workspace creation; conversation
   and Session recovery; Issue scheduling and delivery; trading approval and
   execution; Connector delivery; desktop close/reopen/quit; update and recovery.
3. [x] Establish protocol-boundary directories and coverage manifests: UI/API;
   Alice/UTA; Workspace CLI/tool gateway; Guardian/child processes; desktop
   renderer/preload/main IPC; Alice/Connector; and persisted formats/migrations.
   Include developer workflow/platform contracts already in the area catalog.
4. [x] Map existing assertion evidence to required behaviors. Each row names
   its initial state, action/request, expected state/output, failure/recovery
   path, evidence reference, and environment limits. Mark unreviewed, partial,
   and missing evidence explicitly. Inspect high-priority journey and boundary
   assertions first; never infer complete coverage from a path match.
5. [x] Add group listing, explanation, and safe selection to the existing
   selector. Preserve owner/lane/area/package/path composition. Group selection
   is constrained by lane; it cannot silently run external or system tasks.
   Mixed-runner groups explain the required dedicated commands separately.
   An empty executable selection must not appear successful.
6. [x] Move the existing genuine cross-module specs incrementally into the
   agreed directories and update collection, ownership, aliases, imports, and
   relevant package entry points together. Account for moved evidence without
   collecting a spec twice or dropping it from its intended lane.
7. [x] Add catalog integrity checks for references, ownership, lane, and group
   selection. Update [[docs/testing.md]] with the actual structure and commands.
   Present the reconciled coverage matrix and prioritize Stage 2 from it.

Stage 1 acceptance: every discovered spec and dedicated acceptance task is
accounted for; developers can find and safely select evidence for a scenario
or boundary; missing and partial behaviors are visible; old entry points retain
their scope and side-effect contracts. A leaf spec can remain owner-only when
it proves no product journey or protocol requirement. It must not be forced
into a misleading scenario merely to reach a classification percentage.

## Stage 2: fill critical gaps and enforce truthful acceptance

1. [x] Rank the Stage 1 gaps by user impact, regression history, and boundary
   risk. Start with broker-free first run, Workspace/Session lifecycle and
   recovery, desktop close/reopen/explicit quit, and UTA approval/write
   semantics. The concrete missing assertions come from the matrix, not from
   assumptions that these entire surfaces are currently untested.
2. [x] Add product journeys through real affected layers with isolated state
   and controlled local dependencies. Cover success, failure, interruption,
   retry, and recovery as relevant. Use mocks only at the deliberate external
   boundary; native desktop behavior requires macOS and Windows evidence.
3. [x] Add missing protocol assertions for request/response shape, errors,
   authorization, lifecycle transitions, disconnect/reconnect, cancellation,
   ordering, and idempotency where those contracts apply. Compatibility tests
   target shipped contracts; do not invent compatibility for unreleased shapes.
4. [x] Introduce consistent run summaries for the touched runners: source and
   artifact identity, selected group/scenario, environment/platform, executed,
   skipped, failed, warning, and cleanup outcomes. Required all-skipped runs
   are not acceptance. Required smoke subchecks cannot be reduced to an
   informational warning while the overall result claims acceptance. Define
   advisory versus required subchecks explicitly before changing exit behavior.
5. [x] Connect required deterministic scenario/contract groups to appropriate
   local and CI gates, including the existing integration lane. Keep routine
   PR feedback bounded and stable-release/platform/artifact evidence complete.
   Select affected groups conservatively and use owner/full-suite fallback
   when static dependency selection cannot establish impact. Measure added
   runtime and verify existing workflow contracts before altering CI policy.
6. [ ] Run the required real surface/platform acceptance, update the coverage
   matrix with actual evidence, and report remaining gaps with their limits.
   Live-paper acceptance remains separately selected under the existing
   verified-account and baseline/cleanup contract.

The selected implementation increment contains five bounded behavior rows:

| Required row | Executed layers | Remaining surface evidence |
| --- | --- | --- |
| Broker-free Chat and restart | Workspace bootstrap, Git, durable stores, real controlled CLI child and output decoder | Browser onboarding, credentials and native CLI |
| Session failure, interrupt and resume | Real child failure/termination, HTTP routes, admission blocks and durable identity | Browser/PTY reconnect and packaged application |
| Approval HTTP boundary | Real loopback HTTP, SDK, UTA manager, MockBroker and persisted ledger | Real broker venue, authenticated browser/CLI and version negotiation |
| Run truth | Actual nested Vitest output, required assertion matching and selector rejection | Native/artifact runners retain their own receipt owners |
| Desktop receipt completeness | Mandatory twelve producer checks, omitted/false cleanup and renderer errors | macOS/Windows close/reopen/explicit quit on actual artifacts |

The shutdown journey exposed a production race: `dispose()` returned after
child termination but before task, Issue, conversation and delivery persistence
settled. Dispatch admission/completion tracking now drains those continuations;
concurrent disposal shares one promise, and shutdown rejects new dispatches.
The deliberately delayed persistence regression fails on the prior implementation
and passes with this fix. No persisted format or UTA write ownership changes.

`critical-local` resolves assertion evidence directly from these reviewed rows,
not from a second file inventory. Its required assertions must actually pass;
omitted, skipped, duplicate matches, cleanup/report errors and zero execution
fail acceptance. Local selector receipts record source/index identity, actual
counts, platform, required evidence and runner cleanup. Console warnings are
explicitly not collected; native/resource cleanup is not implied by test hooks.
Existing dev PR and master/manual source jobs run the bounded gate and always
upload its receipt. Dedicated release, desktop and paper gates stay separate.

Stage 2 acceptance: the agreed critical behavior rows have executed evidence
for their required environments; a regression in a required row fails the
corresponding gate; empty/skipped/incomplete checks cannot masquerade as a
pass; CI and release consumers invoke the intended groups with documented
scope and prerequisites. Broader coverage expansion can continue from the
same scenario and boundary structure after this priority set is accepted.

## Verification and delivery

Stage 1 local evidence (Linux, Node 24.19.0):

- Reconciled all 891 original specs after three moves: every existing owner,
  lane, and area assignment remains the same. One new catalog guard brings
  the inventory to 892 specs. The inventory discovers 60 manifest commands
  (including two new inspection aliases) and nine standalone acceptances.
- Seventeen groups contain 37 priority behavior rows, with specific assertion
  references to 22 spec files plus command evidence. The other 870 specs are
  explicitly owner-only; this does not claim an exhaustive assertion audit.
- Actual Vitest collection equals the catalog: 868 default hermetic specs and
  two deterministic integration specs, with no missing or extra files.
- `pnpm test`: 867 files passed, one skipped; 7,422 cases passed, five skipped.
  Host-conditional skips do not establish native Windows/macOS acceptance.
- `pnpm test:contract:workflow`: eleven files and 103 cases passed.
- `pnpm test:integration`: both moved scenarios and all nineteen cases passed.
- Real group execution passed: `--scenario first-run --contract alice-uta
  --owner alice` (eight cases), and `--contract desktop-ipc` (two cases).
- Root, UTA, and UI typechecks passed, as did
  `pnpm exec tsc -p tests/tsconfig.json` for central specs and the new guard.
  Generated the pure Connector/update-lifecycle package declarations for UI.
- The full suite's native CLI children initially lacked the compiled
  update-lifecycle entry point. Built it, rechecked both affected files (sixty
  cases), and reran the full suite successfully. The prerequisite is now in
  [[docs/testing.md]] and the command inventory.
- JavaScript syntax, repository Markdown links, and `git diff --check` passed.
  Discovery/inspection never executed dedicated native, Docker/SSH, external,
  or paper runners. Their additional evidence remains explicit in the matrix.

Stage 2 local evidence (Linux x64, Node 24.19.0):

- Inventory: 900 specs / 70 commands; actual Vitest collection matches all 873
  hermetic and five integration specs, without missing/extra paths.
- `pnpm test:critical`: five files, seventeen passing cases and fourteen
  passing required assertion references; measured bounded run 22.23 seconds.
- Complete deterministic integration: five files / 29 cases passed.
- Workflow/selector contracts: twelve files / 107 cases passed.
- Root, UTA, UI and central-spec/runner-guard typechecks passed. Real Guardian
  recovery smoke passed duplicate ownership, graceful takeover, crash recovery
  and forced stubborn-child reclamation.
- Complete hermetic run executed all 873 files: 869 passed, three failed and
  one skipped; 7,450 passing cases, four failures and five skips. This is **not**
  a passing full-suite result. Connector unlink's timeout passed on isolated
  rerun. Office Session action failure also reproduced on unmodified dev and
  is tracked by #1440; other Office transition assertions vary between runs.
  PTY's final exact probe count reported five instead of four despite completed
  recovery assertions, then passed isolated rerun; tracked by #1671. None of
  these UI/CLI files is changed by this increment.
- The final integration/gate prove local child and loopback contracts only.
  macOS/Windows native desktop, browser journeys, Docker/SSH, external-provider
  and real paper-account runs were not executed and remain matrix gaps.
- Local verification inherited `pnpm_config_verify_deps_before_run=false`
  to prevent this host's pnpm from implicitly reinstalling modified manifest
  dependencies in subprocesses; source/config acceptance was not relaxed.

Implementation changes to the shared catalog, runner, configs, or collection
require root and applicable package/UI typechecks, the complete `pnpm test`,
targeted selector/workflow contracts, and every touched runner's applicable
acceptance. Use dry-run selection to compare pre/post inventories and confirm
that central directories collect exactly as intended. Runner failure/skip
checks should test observable command outcomes, not just mirror implementation.

Deliver the two stages as coherent, reviewable increments targeting `dev` under
the repository's delivery policy. The maintainer explicitly requested a PR
review pause for Stage 1: open its PR and leave it unmerged. The maintainer subsequently authorized Stage 2 and merged Stage 1; keep the
second-stage PR open for review rather than merging it automatically. Keep this plan and [[docs/testing.md]] current in
the same changes as implementation. Remove this plan and its [[PLANS.md]]
entry only when the agreed Stage 2 scope is accepted and durable instructions
are in the owner guide.

### Guardian liveness follow-up
The lifecycle classification selection exposed a real distinction between an
executing descendant and an exited Linux zombie. The bounded fix keeps the
positive signal probe, excludes only an explicit procfs `Z` state, and retains
live status on unreadable/malformed procfs or permission errors. It neither
extends shutdown budgets nor skips real cleanup assertions. The OS still owns
reaping orphaned PID entries.

The real subprocess fixture now waits for the child's IPC readiness before
signaling. Both graceful and SIGTERM-ignoring detached descendants are tested;
the forced branch asserts the saved descendant PID reaches SIGKILL after its
wrapper exits. An independent procfs/absent-PID assertion excludes live survivors.
Unit checks preserve sleeping/stopped/uninterruptible states and fail shutdown
when a retained live descendant survives both signal phases. The headless
interruption fixture uses the same independent OS exit distinction, retaining
its partial-output and interruption assertions.

Evidence so far: Guardian package ten files /69 tests passed (2.53 seconds);
real cleanup two files /27 tests passed (6.24 seconds); root/Guardian typechecks
passed; real `pnpm test:system:guardian` passed healthy conflict/graceful takeover,
crashed-lock recovery, and stubborn-owner forced takeover, including the actual
`pnpm dev` conflict path. Complete hermetic backstop: 877 files passed /four failed /one skipped;
7,498 assertions passed /24 failed /five skipped, in 444.75 seconds. The four
failing files are Desktop smoke process-group cleanup, CLI install mode fixture,
Supervisor PTY (21 cases), and the Supervisor mock fixed independently in #1677.
The package/headless process failures are resolved; npm packaging passes with
the supported writable `npm_config_cache` prerequisite. PTY fixture/output
failures remain unresolved, not uniformly attributed to the host. Expanded
Guardian evidence paths: six files /65 assertions passed (2.71 seconds); whole
critical gate passed 18 assertions with all required references and an accepted
clean-commit receipt. Native Windows/macOS/Bun/Electron acceptance and independent
service-port release remain unverified; a zombie distinction is not native
resource or init-reaping acceptance.

### Independent review: process-name and thread-group safety

Review reproduced two unsafe false-exit decisions in the initial zombie probe:
`42 (worker) Z 1 x) S 1 0 0` let a regex backtrack into legal comm text, and
an exited pthread leader (`Z`, thread count two) still had a sleeping/running
worker that continued output and ignored TERM. Both synthetic regressions fail
against prior head `8676b8c6`; no full-suite rerun is used to diagnose them.

The bounded correction parses fields only after the final comm parenthesis and
requires `state=Z` plus `num_threads=1` for exit. Linux's thread count includes
the retained zombie leader; a live worker makes the count at least two. At the
single-thread snapshot the only task is already exited, so no task remains
able to create another worker. This avoids treating an empty, unreadable or
racing task-directory scan as proof of exit: no directory scan is used, and
missing/invalid counts remain live. Ordinary PID reuse remains governed by the
existing ownership identity checks, not a new claim from this parser.

Automated checks use synthetic leader/thread-count snapshots (including unknown
counts), preserve TERM/KILL failure for live roots, and name real Node wrappers
and descendants `worker) Z 1 x` through `process.title`. Independent OS assertions
confirm those names and actual cleanup. An isolated, optional `cc -pthread`
diagnostic reproduced leader Z /worker S with continuing output; after the
correction it remains live through TERM and receives KILL, then the parent
reaps it in finally. The native diagnostic does not become a compiler dependency
of cross-platform tests. Guardian package: ten files /71 tests passed (2.61s).
Existing force/grace periods remain unchanged, and native/platform gaps stay open.

## Progress

### Lifecycle classification pilot: mapping increment

The read-only report used the `b6165812` snapshot. This implementation starts
from current `dev` at `1a8bec87` (including #1669, #1673 and #1676) and reviews
the actual referenced assertions again. The authorized first increment adds
eight requirement rows, reusing existing tests only:

- `startup-project-selection`: Default migration/explicit override and verified
  attachment/cancellation, including unavailable remote Default preservation.
- `desktop-lifecycle`: selected-Home startup, existing-owner browser handoff,
  request retirement, and graceful/forced child exit plus app-exit fallback.
- `guardian-process`: capability/remaining-lock stop completion and real Node
  descendant cleanup plus cancellation of scheduled recovery on stop.

No spec moves, new assertions, test deletion, owner/lane/package reassignment,
runner/config changes or runtime refactor belong to this increment. The existing
`critical-local` requirement set remains unchanged and must run whole.
Native chooser, Dock/tray/menu Quit, actual SSH, real service recovery and
complete native process/port/lock cleanup remain explicit gaps. A fake child
signal test, a real control socket and a real OS descendant are separate claims;
none substitutes for the others. `kill(pid, 0)` can still see an unreaped zombie
on a host without a reaping init; preserve that environment limit rather than
removing the descendant assertion. Installer umask fixtures are outside this
mapping increment and are not modified.

Before/after data-only selection on this source base:

| Query | Before | After | Limit |
| --- | ---: | ---: | --- |
| `--scenario startup-project-selection` | Not registered | 4 files | Real temporary FS/loopback fixtures, FakeTui; no native multi-client journey |
| `--scenario desktop-lifecycle` | 1 file | 6 files | Includes the same IPC spec as `desktop-ipc`, without duplicating collection |
| `--contract guardian-process` | 1 file | 4 files | Dedicated system commands remain separate |
| Complete spec inventory | 909 files | 909 files | Owner, lane, areas and command inventory unchanged |
| Owner-only inventory | 882 files | 871 files | Eleven newly mapped existing files, not eleven new tests |

Representative change-scope feedback must still inspect cumulative impact:
window callback work can start from its one path; shared Default work needs the
startup scenario plus Desktop/IPC evidence; descendant/stop work needs the
Guardian contract independently, not a Desktop-scenario AND Guardian-contract
intersection. Metadata cannot make the static import graph complete for child
process or native paths.

Verification on this increment (Linux x64, Node 24.19.0, pnpm 11.19.0):

- `pnpm test:contract:workflow`: twelve files / 108 assertions passed.
- `pnpm test:select --scenario startup-project-selection,desktop-lifecycle`:
  ten files, 143 assertions passed / one failed. The failure is the newly
  discoverable existing `keeps an unavailable remote Default detached across
  healthy local polls` fixture: its injected pi-tui object lacks #1669's
  `isKeyRelease`, so the finally-block `q` cleanup throws. The same failure
  reproduces in an unmodified detached `1a8bec87` worktree. It is not suppressed
  or removed from the map; that group receipt has `accepted: false`.
- `pnpm test:select --contract guardian-process`: four files, 31 assertions
  passed / one failed. The descendant termination fixture leaves a zombie PID
  reparented to this container's PID 1 (`tail`, not a reaping init). `ps` showed
  the reported survivor in `Zs` state. The same process failure reproduces in
  the unmodified base worktree; its receipt is also `accepted: false`.
- `pnpm test:critical` ran whole: eighteen assertions passed (seven hermetic,
  eleven integration), all fifteen required references passed and the receipt
  has `accepted: true`. No required row or filter was changed.
- Root, UI, CLI, Guardian and central-spec/guard typechecks passed. The UI
  required building its existing Connector protocol declarations; native CLI
  children required the documented update-lifecycle build.
- Data-only scope probes: startup with Runtime/CLI owner = four; Desktop with
  Desktop owner = six; Desktop plus desktop-ipc = one shared IPC file; startup
  plus guardian-process = zero (expected exit 2); window-only path = one.
  Desktop changed dry-run = 24 candidates, not an executed import-graph closure.
  Existing file/owner/lane/area inventory and command inventory compare equal;
  all referenced assertion fragments and documentation links resolve.
- Complete hermetic backstop (`pnpm test`): 882 files, 874 passed / seven
  failed / one skipped; 7,522 assertions, 7,490 passed / 27 failed / five skipped.
  The seven failing files are `scripts/desktop-smoke-process.spec.mjs`,
  `scripts/pack-cli-npm-packages.spec.mjs`, `src/workspaces/headless-task.spec.ts`,
  `packages/guardian-runtime/src/process-control.spec.ts`, and CLI
  `install.spec.mjs`, `supervisor-tui.pty.spec.ts`, `supervisor-tui.spec.ts`.
  Process-cleanup failures report surviving PIDs; the mapped Guardian failure
  has the confirmed zombie reproduction above. npm pack cannot create this
  host's default `/home/agent/.npm/_cacache`. The installer mode fixture runs
  under umask `0077`: its initial HTML already has mode `0600`, so changing it
  to `0600` does not create the intended mismatch. The PTY file accounts for
  21 failures, with `/fixture` mkdir errors, timeouts and output mismatches;
  these remain unresolved and are not all attributed to the environment.
  No failures were filtered away or repaired in this increment.
- Native Electron/system/SSH/installer or broker acceptance lanes were not run:
  no implementation/runner changed and their explicit evidence gaps remain.
  The hermetic installer fixture above is distinct from native installer
  acceptance. The mapping does not claim new native acceptance or a green
  complete suite.

The initial dependency install could not download from GitHub via direct Node
fetch or Node headers from nodejs.org. Local dependency links were installed
with lifecycle scripts disabled; node-pty was then built successfully using
matching Node headers from the Node binary npm package. Local Git uses dugite's
supported `LOCAL_GIT_DIRECTORY=/usr/local` and
`GIT_EXEC_PATH=/usr/local/libexec/git-core` overrides. No test assertion was
skipped for these prerequisites. Isolated base diagnostics disable pnpm's
dependency auto-reinstall (`pnpm_config_verify_deps_before_run=false`) when
sharing the installed dependencies; name filtering there is diagnostic only.

The existing Supervisor fixture defect is deferred from this metadata-only
scope; retain its reproduction in the Draft PR rather than broadening this
increment into a runtime or fixture repair.

#### Authorized lifecycle validation follow-up

The subsequent bounded continuation fixes the Supervisor test's injected
pi-tui shape by supplying the existing real `isKeyRelease` function, matching
the other fixtures and #1669's input contract. No behavior assertion changes.
Startup plus Desktop now pass all 144 assertions in ten files (3.01 seconds;
previously 143 passed / one failed). Guardian process liveness and inspected
mapping omissions are investigated separately; native gaps stay explicit.

- 2026-09-30: Completed the read-only audit and agreed the direction of product
  scenario/protocol boundary grouping. Proposed the two-stage sequence above.
- 2026-09-30: Implemented and locally verified Stage 1 on
  `codex/test-system-grouping`. Moved two integration specs and one workflow
  contract, added coverage directories/inventory and composable group
  selection, and recorded important gaps without treating them as passes.
  Stage 2 product regressions, run receipts, and CI policy changes remain open.
- 2026-09-30: Integrated the current-dev startup viewport and Issue Session
  guidance increments, then repeated full-suite, root/UTA/UI/central typecheck,
  and deterministic integration verification successfully before PR delivery.

- 2026-09-30: Implemented the bounded Stage 2 priority rows, real local journey
  and HTTP tests, assertion-level required gate, truthful run receipts and
  receipt uploads in existing source CI jobs. Fixed terminal persistence during
  Workspace shutdown and incomplete desktop receipt acceptance. Retained broad
  native/browser/venue gaps; full-suite failures are recorded above rather than
  counted as green acceptance. Synchronized with the accepted #1667 merge;
  delivery targets current dev in a new review PR.

## Maintainer review cleanup and post-merge acceptance checklist

PR #1672 follow-up keeps rejected shutdown completion visible as the existing
AggregateError while closing transcript resources in a finally block. Its
regression covers concurrent/repeated disposal and a watcher close failure.
This is a completion-drain guarantee, not a storage durability certification:
HeadlessTaskRegistry and AgentConversationLog still warn and swallow some disk
write errors, and the dispatch catch can absorb failures after terminal status.
Those preexisting storage behaviors are outside this bounded cleanup.

All runnable Vitest configurations now share absolute collection metadata
triggers. Metadata-only changed selection has an executable Git/Vitest
regression; it does not imply that dynamic product dependencies are completely
represented by the static import graph. Guardian lock spec evidence explicitly
uses FakeProcesses with real filesystem state; real multi-process contention
and platform/launcher composition remain a separate acceptance gap. Packaged,
onboarding and trading-mode smoke commands currently support macOS only;
Workspace artifact acceptance retains its separate Windows support.

After the maintainer merges Stage 2, use this checklist against the merged
commit rather than treating a green bounded gate as complete product coverage:

| Question | Repeatable check / evidence | Acceptance limit |
| --- | --- | --- |
| Can tests be navigated by product scenario and protocol boundary? | `pnpm test:select --groups --json`; `--scenario conversation-recovery --json`; `--contract alice-uta --json` | Catalog/dry-run output proves discoverability, not behavior. |
| Do owner, lane, package and changed selectors compose? | `pnpm test:contract:workflow`; `scripts/test-collection-inputs.spec.ts` | Includes metadata-only changed collection; dynamic dependencies still need explicit selection. |
| Does the critical local set actually run? | `pnpm test:critical --receipt artifacts/tests/critical-local.json` | Require accepted=true and every required reference uniquely passed at the exact merged commit. |
| Are local journeys and fault paths covered? | `pnpm test:integration`; delayed/rejected shutdown, Session crash/recovery, HTTP interruption and mock-paper approval tests | Controlled Node agents and MockBroker; no paid native agent or real venue acceptance. |
| Can skipped, omitted, ambiguous or failed evidence pass? | `scripts/test-results.spec.ts`; `scripts/workspace-acceptance-receipt.spec.ts` | Real Vitest report fixtures and receipt validation; native/venue cleanup is not inferred. |
| Does CI enforce the required evidence? | Exact-head dev PR Clean Build result and uploaded critical receipt; source CI workflow contract tests | Check the actual commit and receipt, not a prior head's green status. |
| What remains uncovered? | `pnpm test:select --groups --json`; native/system/external/live command prerequisites and coverage row scopes | Preserve browser/PTY, native desktop, Docker/SSH, multi-process Guardian, provider and paper-venue gaps. |
| Is the complete hermetic suite healthy? | `pnpm test`, separately from the required gate | Record failures and compare baselines; do not classify a bounded gate as the full suite. |

This checklist is prepared for post-merge review. Neither merge nor release is
performed by this follow-up.

#### Assertion-level omissions and duplication audit

The lifecycle follow-up adds two previously owner-only files to bounded groups:
`lifecycle-command.spec.mjs` supports explicit registered-home dispatch as well
as browserless readiness presentation; `lifecycle.spec.mjs` supports the core
starting-to-running/ownership transition. Startup now selects five files,
Desktop six, Guardian six; total inventory stays 909 and owner-only drops from
871 to 869 (13 mapped files over the original 882 baseline). File reuse across
scenario/protocol groups still does not duplicate execution.

The same inspected files now describe independent safety claims that file-level
selection already ran: Default writer serialization/concurrent config retention,
live-owner stale heartbeat, PID reuse, forced takeover, and capped retry/reset.
Fake timer recovery is not promoted to real service recovery. Core readiness,
CLI presentation, real control sockets, and OS descendant termination remain
separate evidence levels.

| Inspected overlap | Distinct claims retained | Decision |
| --- | --- | --- |
| Default resolver, config writers, Web relay, TUI | Explicit override; durable serialization; verified request cancellation; polling does not attach fallback | Keep all layers and races; cross-reference files |
| CLI lifecycle core and command presentation | Actual orchestration with injected child/status; dispatched named Home and output/browser boundary | Map both; neither replaces real launcher smoke |
| Runtime lock tests | Live heartbeat authority; PID reuse protection; forced takeover; contender serialization | Different ownership safety invariants; retain |
| Desktop close/Dock/tray | Close hides; Dock event restores; tray helper restores; quitting suppresses activation | Different entry paths/state transitions; retain |
| Desktop fake-child and Guardian real-child shutdown | Signal/timer decision; actual descendant execution stops after wrapper exit | Different fidelity; retain |
| Relay cancellation tests | Late verification cannot commit; cancelling old request cannot cancel replacement | Different race outcomes; retain |

No same-layer duplicate in these inspected clusters has a demonstrated identical
behavior/precondition/failure oracle; no assertion or test is deleted. PTY input,
pointer/render and terminal-specific regression work must also select
`packages/cli/src/supervisor-tui.pty.spec.ts` explicitly (or the Runtime/CLI
owner); its known fixture/path and transcript failures are not certified by the
bounded mock/HTTP startup selection. This remains a separate terminal surface,
not native Desktop or SSH acceptance.

Reproduce independent scope probes:
`pnpm test:select --scenario startup-project-selection --owner runtime-cli --list --explain`;
`pnpm test:select --contract guardian-process --owner runtime-cli --list --explain`;
`pnpm test:select --scenario desktop-lifecycle --contract desktop-ipc --list --explain`.
Startup and Guardian intersect on the shared command-presentation file only;
that intersection omits the core, lock, and real descendant evidence. Run the
whole affected protocol separately. Metadata does not repair static import
closure across native processes.

Expanded mapping validation: workflow 12 files /108 assertions passed;
startup plus Desktop 11 files /157 assertions passed (2.86 seconds). Data-only
owner/intersection probes returned startup five, Guardian six, IPC one, and
startup/Guardian intersection one. Inventory confirms 909 specs, 70 commands,
869 owner-only entries. Guardian selection still needs the separate process
liveness fix in Draft #1678; that PR verifies the same six mapped paths against
its fixed source. Drafts are intentionally independent, with neither merged.
