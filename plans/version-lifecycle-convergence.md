# Version Lifecycle Convergence

Status: In progress. One Draft PR (#1724); artifact/system acceptance and the
remaining authority audit are pending. No release publication or merge acceptance.

## Current implementation and evidence

- Identity: backend, CLI and Guardian share the existing product build value or
  known root manifest; cwd search and fake product versions are removed. Desktop
  relay/CLI packaging derive root identity; the private CLI package no longer
  authors a version. CLI/backend share the shipped provenance parser. Source
  execution reports development. Missing native receipts remain unavailable; explicit
  missing/invalid receipts fail instead of becoming source/stable installations.
  Desktop declares its actual mode and ignores unrelated inherited CLI receipts.
  The relay bundles shared identity so build injection reaches packaged bytes.
- Workspace: the existing managed-template owner supplies shared eligibility to
  discovery, review and locked apply. Private ordering and equality-only decisions
  are removed. Unknown versions stay unknown; equal-version Skill projection
  remains fingerprint-driven. Real disposable Git/tool acceptance passes 38 cases,
  including rejected downgrade without mutation and forward beta-to-stable apply.
- Discovery: backend, CLI, relay, native desktop and UI retain shared status/reason.
  Native download follows shared eligibility; handoff retains the exact target.
  Duplicate native wire types are removed. Failed discovery cannot authorize
  an update from cached observations. The shipped `hasUpdate` field is a projection.
- Execution/recovery: App-only and coordinated installs use the existing control
  service's review/approve/resume entry. Direct native-install IPC, preload and
  demo handlers are deleted, as is the redundant `assertNativeInstall` check.
  Status/resume/abandon/startup select the same unfinished owner. Native children
  retain parent operation IDs; matching versions do not imply parentage.
- Publication: release preparation, candidate validation, native feed names and
  predecessor ordering use shared pure policy. Private parsers and manual root/CLI
  synchronization are removed. The existing serialized publisher checks forward
  release or exact-head mirror intent and re-reads the observed head before any
  mutable write. Bash and real PowerShell bootstrap planning now agree with shared grammar
  for stable/beta manifest and exact-version input, including malformed versions.

Whole-branch checks at `00e1b82c`, before the publication and App-entry changes:
complete suite 896 passed files / 7,638 passed tests (1 file / 8 tests skipped);
critical gate accepted all 15 required assertions; real Guardian ownership,
takeover, crash and forced-recovery smoke passed. Root, CLI, desktop, UI and
integration typechecks passed. Earlier real demo Settings exercised owner review;
the complete UI owner suite passed 357 files / 2,062 tests. Source CLI/backend
imports from the desktop cwd both reported root `0.94.1` and source ownership.

Latest acceptance before the final whole-branch refresh:
- Native macOS arm64 Bun 1.4.2 archive passed real CLI/Guardian/backend startup,
  independent Agent PTYs, Workspace CLI transport, and same-version payload
  activation/readiness. Source identity and runtime ownership remain separate.
- Unsigned integrated Electron passed all 13 packaged Workspace checks, including
  persisted native handoff/restart readiness and the real update inventory.
  Packaged separated Electron connected to a real published 0.94.1-beta.2 backend;
  its own client remained 0.94.1. Final rebuild follows the inherited-provenance fix.
- Disposable Linux SSH acceptance passed installed-versus-active beta.2-to-stable
  activation, interrupted controller reconnect and no unnecessary reinstall/restart.
- Local Docker installer and the interactive playground passed plan, decline
  without state, approved install and CLI invocation. Actual Bash and PowerShell
  planning passed 44 grammar cases per interpreter. PowerShell ran on macOS;
  native Windows installer replacement and signing remain platform release gates.
- Root/CLI/UI/desktop/shared policy/Guardian and integration typechecks passed
  before the final backend mode precedence correction; refresh is pending.
- Latest full suite exposed one test fixture bug: PATH executable lookup accepted
  PowerShell's `tr` language directory. Rejecting directories in that existing
  fixture fixed the reproduction with the same PATH. Targeted installer suite now
  passes 33 tests. No installer product fallback was added.
- Artifact acceptance exposed an actual launch bug while clearing inherited mode:
  CLI's `cli-server` ownership must be assigned after child environment composition.
  The launch entry now does so; the rebuilt native archive passed. The failure was
  not bypassed by weakening readiness or adding a second startup status.

Final whole-branch tests, critical gate, artifact refresh and authority audit remain
in progress. Existing user Electron and #1704 preview remain untouched. No release
publication, signing, channel mutation or PR merge has been performed.

Tracking: [#1721](https://github.com/TraderAlice/OpenAlice/issues/1721).
Existing defects: [#1705](https://github.com/TraderAlice/OpenAlice/issues/1705),
[#1706](https://github.com/TraderAlice/OpenAlice/issues/1706), and
[#1717](https://github.com/TraderAlice/OpenAlice/issues/1717).

Owner guides: [[docs/update-lifecycle.md]], [[docs/workspace-template-upgrade.md]],
[[docs/harness-web-surfaces.md]], [[docs/managed-workspace-runtime.md]],
[[docs/local-runtime.md]], [[docs/remote-access.md]], [[docs/cli-installer.md]],
[[docs/cli-package-managers.md]], [[docs/development-workflow.md]], and
[[docs/testing.md]].

## Problem and evidence

At dev `64314ea23630a49dc1ae221c367256b228955db2`, shared version policy exists
but several entry points bypass it or discard its result. The audit reproduced:

- Identical backend code reports `0.94.1` from the repository cwd and `0.1.0`
  from `apps/desktop` when `OPENALICE_APP_HOME` is absent.
- Workspace list ordering ranks `0.94.1-beta.2` above `0.94.1`; shared ordering
  correctly ranks it below stable.
- A real disposable Git Workspace accepts a managed-template plan from stable
  to beta.2, writes the older content, and persists the older applied version.
- CLI discovery changes shared `blocked / older-release` into `current`.
- Without installation metadata, a dev source context defaults to stable in
  CLI provenance while backend identity reports dev.
- Candidate validation accepts beta.0 and beta.01 while shared channel policy
  rejects them. Additional release gates prevent treating this as evidence of
  a malformed public release.

The initial audit also identified native journal routing; #1717 owns its
production-service reproduction. Native discovery bypass and missing forward
channel-head publication validation are source-inspection findings, not proof
of a real native downgrade or public feed rollback.

Six related spec files passed all 106 tests during the audit despite these
reproductions. Existing rehearsal fixtures do not exercise real template apply.

## Decisions and scope

Root `package.json#version` is the product's authored version. CLI, desktop,
renderer delivery, and bundled backend derive from that build identity. A
separately deployed backend may run a different release; connecting to it must
not replace the local client's identity. Relative versions do not establish
protocol compatibility.

Reuse `packages/update-lifecycle` for precedence, channel eligibility, and exact
activation evidence. Reuse existing launch/build identity injection, provenance
ownership, Workspace managers, native installer, and operation journals. Do not
introduce another version package, manager, identity document, approval system,
or parallel test runner.

| Meaning | Authority and boundary |
|---|---|
| Product version | Root authored version, carried by existing build/launch mechanisms |
| Installation channel and updater | Existing installation provenance and actual launch mode; not inferred from a selected remote backend |
| Release precedence | Shared SemVer policy; stable exceeds same-core beta, build metadata is not precedence |
| Dev build identity | Existing commit/payload evidence; commits are not ordered versions |
| Workspace content baseline | Existing applied template state or exact source receipt |
| Apply completion | Exact approved identity, owner transaction receipt, and readiness |
| Schema/protocol/ABI version | Existing format/protocol owner; never compared as product releases |

Keep explicit source selection, rollback, and channel switching distinct from
ordinary updates. Content reconciliation for Alice Harness skill projections
still uses file fingerprints; applying release precedence must not disable
same-version content reconciliation or invent ordering for snapshot tags.

Settings retains App, Backend, and Alice Project, with only persisted default
Chat/Quant/Prediction content under Project. This work changes data authority
and truthful status copy, not layout, selection controls, or navigation. Existing
shared primitives retain keyboard, focus, and responsive behavior.

## Ordered construction checklist

### 1. Converge product identity and installation provenance

- [ ] Route CLI, backend, Guardian dev/prod, and desktop build identity through
  the existing product build value (`__OPENALICE_BUILD_VERSION__` where bundled)
  and the known product root for source execution. Validate product identity;
  an arbitrary cwd package or unrelated named package must never qualify.
- [ ] Remove backend cwd candidate search, Guardian cwd readers, and invented
  `0.0.0`/`dev` product versions. Missing identity stays unavailable and cannot
  authorize an update; malformed packaged identity fails artifact acceptance.
- [ ] Stop authoring two product versions. Derive distribution-required package
  metadata from root during existing packaging, update release-prep validation
  accordingly, and retire manual root/CLI synchronization. Internal private
  package versions must not leak into product status.
- [ ] Reuse the existing installation-provenance parser instead of retaining
  the backend copy. Preserve shipped provenance schemas and explicit invalid
  metadata errors. Absence in source execution means source ownership, not a
  fabricated installed stable release.
- [ ] Remove unused `__OPENALICE_UI_VERSION__` define/declaration and obsolete
  identity exports after checking all consumers.

Acceptance: source CLI, Guardian status, backend HTTP, and Electron IPC agree on
product identity across cwd changes. Packaged CLI and integrated Electron agree
with their artifacts; separated Electron keeps its own identity when connected
to another backend. No source invocation acquires native installation authority.

### 2. Make Workspace eligibility authoritative at the existing owner

- [ ] Use shared ordering inside the existing managed-template owner for one
  applicability result covering newer, equal, older, and unavailable identity.
  Remove the private comparator in `service.ts` and replace independently
  derived list/check/tool/UI conclusions with the owner result.
- [ ] Have check, plan, coordinated review, and apply consume that applicability
  rule. Apply re-reads baseline and exact target inside its existing lease;
  an ordinary upgrade to an older target cannot mutate files or receipts.
- [ ] Remove template-registry missing-version substitution with `0.0.0`.
  Propagate missing evidence explicitly. Do not bulk rewrite old Workspace
  state or guess a version from mutable README content.
- [ ] Remove equality-only eligibility checks from tool and React previews.
  Preserve the same-version changed-template diagnostic and legitimate
  fingerprint-driven skill projection semantics in their existing owner.
- [ ] Keep AQ/AP source selection and exact commits with their source manager.
  Automatic discovery orders comparable releases only; explicit source choices
  remain deliberate reviewed selections, including qualified snapshots.

Acceptance: reproduce stable-to-beta and newer-to-older Chat requests through
direct apply as well as ordinary UI/tool paths; all leave files, Git HEAD, and
applied baseline unchanged. Prove a forward update still merges and persists
the accepted baseline. Prove changing the target after review cannot authorize
a downgrade. Check non-default Workspaces through their explicit management
entry without expanding Settings discovery beyond the three defaults.

### 3. Preserve shared discovery decisions through every presentation

- [ ] Remove CLI `blocked -> current` and `unknown -> unsupported` conversions.
  Carry the shared selection status/reason through existing response types;
  installation capability remains separate from release availability.
- [ ] Have native desktop discovery consume the same release eligibility and
  channel policy. Remove independent product-level channel/availability
  inference; electron-updater retains feed transport, payload verification,
  download progress, and installer handoff. Recheck the approved exact target
  before installation without inventing a second native update engine.
- [ ] Update Settings, relay, TUI, desktop notifications, and demo adapters to
  present owner decisions. Failed refresh may retain an observation but cannot
  turn it into fresh approval or successful verification.
- [ ] Read applicable shipped API contracts before retiring fields. Replace
  unreleased duplication directly; keep any necessary shipped-wire adaptation
  at one boundary without recomputing eligibility in the UI.

Acceptance: the same current/candidate/channel inputs yield the same decision
in backend, CLI, and native adapters. Exercise stable/beta order, beta.2/beta.10,
build metadata, malformed/missing identity, explicit channel changes, and
same-version dev payload changes. Walk the real Settings route and demo;
unavailable, blocked, failed, and current must remain distinguishable.

### 4. Route recovery to the exact unfinished operation

- [ ] Remove journal-existence priority in desktop status/resume/abandon.
  Select the unfinished operation and its owner consistently in the existing
  control service; all three commands use the same selection.
- [ ] Keep native child receipts and coordinated parent receipts. When related,
  retain their existing ownership relationship; unrelated unfinished operations
  must not silently replace one another. Completed history cannot mask recovery.
- [ ] Preserve restart reconciliation and exact-target protection; do not erase
  an unfinished approval to make another installation proceed.

Acceptance: complete a Project update, then fail native handoff. Status exposes
the failed native operation; resume/abandon reach that same operation. Exercise
the reverse ordering, parent/child coexistence, restart, and mismatched target.
Use disposable journals, then the existing unsigned packaged restart path.

### 5. Converge release validation and forward publication

- [ ] Delete private JS SemVer parsing/comparison in release preparation and
  candidate validation; consume the existing shared package's policy. Keep its
  pure entry usable by build tools without adding another release framework.
- [ ] Align authored version, generated manifests, candidate receipts, updater
  feed naming, and channel acceptance. Keep shell/PowerShell bootstrap parsing
  dependency-free and prove equivalent accepted version/channel cases against
  the shared authority rather than embedding a new runtime dependency.
- [ ] Use shared precedence at release intent and immediately before replacing
  an active stable/beta channel head. A new release must move that channel
  forward; preserve existing mirror repair of the same active release and
  commit-bound dev publication semantics. Account for the existing release
  serialization and changed-head evidence at the publication boundary.
- [ ] Retire redundant regexes, manual version synchronization instructions,
  and obsolete workflow assertions with their replaced implementation.

Acceptance: exercise stable and beta syntax, rejected beta.0/beta.01 and leading
zeros, backward/same/forward publication, same-head mirror repair, and a changed
head before upload using local fixtures. No real tag, signing, channel write,
or publication is required for these checks.

### 6. Close the entry-point coverage gap and complete acceptance

- [ ] Extend existing owner/integration specs with the reproduced failures.
  Replace weak nonempty-version assertions and mocks that manufacture the
  decision under test. Keep transport fixtures; exercise production identity,
  eligibility, transaction, and routing together where the defect crosses them.
- [ ] Keep rehearsal as a consumer of production policy. Remove duplicate
  decision logic; label fixture content/publication scope accurately. Real
  Workspace transaction and native artifact evidence stay in existing suites.
- [ ] Run root, CLI, UI, and touched package typechecks, complete `pnpm test`,
  the required critical gate, and affected integration suites. Build existing
  shared package dependencies before real CLI subprocess tests.
- [ ] Run real source launch, unsigned integrated/separated Electron acceptance,
  native CLI artifact identity, Guardian launcher checks, installer playground,
  and disposable SSH installed-versus-active upgrade/reconnect acceptance as
  required by the touched owners. Record platform-specific gaps explicitly;
  source or mocked evidence cannot certify a native artifact.
- [ ] Re-audit the complete diff for private comparators, cwd version guesses,
  fake defaults, duplicate provenance parsing, lossy decision conversion, and
  journal-existence routing. List remaining adapters with their actual transport
  or shipped compatibility reason; do not leave a second policy implementation.
- [ ] Update existing owner guides with verified final behavior, close linked
  defects only with their acceptance evidence, and remove this plan and its
  active index entry in the final accepted change.

## Completion criteria

One authored product version reaches every supported build/launch entry. One
shared release policy governs discovery and ordinary update eligibility. Existing
owners enforce that policy at mutation boundaries, and consumers retain its
meaning. Product, content, schema, and protocol identities remain unambiguous.
Recovery commands reach the operation being displayed. Release validation and
channel-head movement agree with the consuming client.

Completion requires the entry-point and artifact evidence above, not only a
green comparator suite or simulation. The implementation removes competing
authority; necessary regression coverage does not justify a parallel workflow.
