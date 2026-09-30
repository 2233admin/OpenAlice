# Test system grouping and product coverage

Status: Stage 1 accepted and merged as PR #1667. Stage 2's bounded local
coverage and gates are implemented for a separate maintainer review PR;
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

## Progress

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
