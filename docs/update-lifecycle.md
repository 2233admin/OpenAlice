# Update Lifecycle

This guide owns shared release identity and selection policy. Transport discovery,
installation and project execution remain with their owners: [[docs/remote-access.md]],
[[docs/cli-installer.md]], [[docs/managed-workspace-runtime.md]],
[[docs/workspace-template-upgrade.md]] and [[docs/harness-web-surfaces.md]].
The remaining migration is tracked in [[plans/update-lifecycle.md]].

## Shared release selection

`packages/update-lifecycle` is a pure TypeScript package with no React, filesystem,
network or process dependency. Production backend version discovery, CLI update
checks, the frontend update indicator and the Dev Panel rehearsal consume it.
There is no UI-local discovery comparator or server/CLI comparator re-export.
Workspace source-tag ordering also uses the shared SemVer comparator. Qualified
`snapshot-*` catalog entries are opaque exact selections: they remain selectable
but cannot be ordered as release zero or auto-upgraded without a comparable
baseline. Template managed-file versions retain their existing owner-specific
convention for now.

- A release identifies a channel and version, with a commit for development builds.
  An owner with same-platform payload evidence can additionally supply its artifact
  checksum. Release selection does not replace checksum/trust verification.
- `selectRelease` receives the accepted head of the requested feed. The adapter
  validates that feed's source and payload before invoking selection.
- Stable and beta use SemVer precedence; build metadata is not precedence.
  Invalid or missing identity is unknown, not version zero or proof of being current.
- Dev commits are identities, not sortable versions. Owners with artifact receipts
  compare payloads, including rebuilt commits; otherwise commit equality is used.
- Normal discovery blocks a lower SemVer candidate. Explicit `switch-channel`
  intent can select a different channel's older head; it is not installation
  approval. Same-channel downgrade is not an ordinary update.
- Selection says whether a candidate is available, current, blocked or unknown,
  with a reason. It does not prove client/backend protocol compatibility.

The Node CLI consumes the package's built ESM, while repository tests resolve its
source. Workspace dependencies and the build graph must build it before CLI/UI
consumers. Shared identity and selection tests live beside the package; network,
installer and native-update tests stay with their effect owners.

## Exact activation evidence

`verifyReleaseEvidence` compares the approved target with an installed or active
receipt. A different newer version is a mismatch, not success. Missing/invalid
versions, full commits or payload hashes remain unknown; an adapter cannot drop
required target evidence to manufacture success. Build metadata is identity here,
not SemVer precedence. Compare artifact hashes only for the same installation
unit/platform. Installer provenance is not release identity.

Electron's existing restart marker and rehearsal activation verification consume
this rule. The native marker currently supplies version evidence only; native
payload validation remains with electron-updater. This does not yet replace the
owner journal or verify every service's readiness after application startup.

## Shared discovery resource

`DiscoveryStore` in the same pure package owns read-only probe single-flight,
success/error TTLs, timestamps, subscriptions and invalidation. Adapters supply
the reader and TTL policy; they retain feed parsing, transport timeouts and
installation authority. Forced checks bypass settled cache entries but join an
already-running probe. TTL begins when the probe finishes.

A failed refresh preserves the last successful observation and its timestamp,
and records the new error/check time separately. A failed `check()` returns null,
not the cached observation: commands cannot mistake stale data for freshly
verified approval. This store neither authorizes nor executes an installation.

The backend owns one resource per supported release channel (a bounded two-entry
inventory). The frontend provider and rehearsal use the internal React snapshot
binding with one resource per current target/channel generation. Switching away
and back does not revive old responses or callbacks. React no longer implements
its own discovery request state machine; `useVersionDiscovery` is removed.
Project status and preference responses are also fenced by connection generation.
Native client status is independent of the selected backend.

## Project commands and UI entry

`WorkspaceUpdateService.check()` observes AQ/AP stable upstream releases even
when automatic merging is disabled. It never creates a source plan or applies
content. `applyPolicy()` is a separate serialized command: it re-reads policy,
plans the exact observed target, checks policy again after planning, and invokes
the authoritative source manager with its digest. Activation, the background
timer and a saved policy change explicitly call `refreshAndApplyPolicy()`.
`POST /api/updates/check` only checks; saving preferences no longer depends on a
browser follow-up request to start approved automatic work. Failed discovery
retains the previous observation but cannot trigger an automatic apply. AQ/AP
manual source review exposes the same stable upstream candidates regardless of
auto-apply policy; candidate visibility is not permission to merge.

The sole public React hook is `useUpdateLifecycle`. Its provider owns the
native status subscription, client install command and Machine plan/progress
state. Settings, desktop prompt and Machine controls subscribe to it; there is
no `useMachineManagement` or nullable companion lifecycle hook. Shared chrome
can request the same hook's optional preview mode. Connection/fleet CRUD still
belongs to the connection owner. Source repository discovery also uses the
shared cache primitive rather than an independent promise/expiry implementation.

### Shared review plans

The same provider owns the Workspace preview inventory used by the overview and
the existing template/source review panels. Read-only candidate discovery
prefetches the primary plan. Opening or reopening a review reuses that exact
observation; it does not request another preview. The first status response
joins an inventory prefetch. Subsequent automatic checks and explicit refreshes
update the same resource and coalesce concurrent requests.

Each backend recovery generation owns a fresh inventory. Workspace identity,
template versus source versus Alice Harness layer, and skill/action projection
form separate keys. A changed template baseline, source receipt or candidate,
removal, successful apply, and backend retirement invalidate affected entries.
An already-open review observes invalidation. A retired response cannot restore
an old plan, including when switching away and back. Relay target switches
already reload the renderer; no module-global plan survives that boundary.

Failed reads retain the last successful preview alongside the error and disable
application. Reopening retains the error instead of silently retrying. A
backend apply rejection containing a revised plan replaces the shared digest;
template conflict choices reset when that digest or scope changes. Existing
backend digest, activity, transaction and exact-target checks remain approval
authority. Scoped Alice Harness/skill plans do not become whole-template update
evidence. Source identity includes its commit even when version labels match.

Remote Machine review likewise shares its pending or settled target/project
plan. Automatic discovery and explicit retries refresh it; closing the overview
review keeps it. Refreshing or failed discovery blocks approval synchronously,
even before React commits the new loading state. The native owner still enforces
plan expiry and single use. A fresh review also retries operation-status reads.

Review updates opens the sole actionable target directly. Multiple updates
retain a chooser with exact Workspace targets. The Workspace modal host sits
under the same lifecycle provider as the shell; it uses the existing modal and
button primitives and retains its keyboard/focus and narrow-screen behavior.
Attention presentation and backend update engines are separate workstreams.

## Current migration boundary

Native SSH Runtime updates and rehearsal release stages now use the same
`planRuntimeUpdate` and `transitionRuntimeOperation` contract. The planner
separates installed, active and target identity, retains newer installations,
and plans activation without installation when bytes are already present.
The SSH adapter validates target-local provenance, control compatibility and
owner identity; the rehearsal supplies explicit fixture evidence. Its publication,
client restart presentation and Workspace-content scenarios remain adapters,
not production compatibility evidence.

Native remote execution records its approved target, selected project home,
original owner and stage receipts in `<remote-targets.json>.updates/` on the
controlling client. The existing process-identity lock serializes controllers on
that client per SSH profile. A new controller probes actual state, preserves the
recorded target, requires fresh plan consent for remaining mutations, and only
performs unfinished installation/activation/reconnect work. An unrelated owner
or changed installed target blocks recovery. Remote Guardian ownership and the
installer transaction remain their own authorities; this is not a distributed
fleet lock. Receipt writes are atomic, private, and contain no credentials.
The version-1 journal is new state, not a migration of an existing shipped shape.

Local client policy and host discovery have separate authority. Native desktop
self-update and Workspace operations retain their owner engines; a durable
operation spanning those units and SSH is still outside this increment.
Terminal passive notices also still need convergence with discovery.
Do not infer full lifecycle or real installation acceptance from discovery or
IPC-mock tests. Advance the canonical plan rather than introduce another public
hook or independent request-ordering rule.

## Overview surface and local client policy

Settings Overview separates App, Backend and AliceProject cards. Project content
has individual Workspace versions, not an invented aggregate project version.
The shared `useUpdateLifecycle` observation also projects one guidance path:
avatar indicator, Settings menu, Overview navigation, owner card and exact
Workspace row all use the same available target set. Automatic AQ/AP work
blocked only by an active runtime stays on its row as waiting, without raising
an actionable blue count; manual blockers and failed target updates use a
separate needs-attention count. The Overview summary links directly to each
target while ordinary `/settings` navigation retains its own scroll position.
The old About component and duplicate status summary are retired. Details and
update scope selection share one dialog; actual commands retain the authoritative
native, Machine and Workspace merge approvals. The current UI explains that
cross-app-restart multi-target continuation is still pending rather than promising
it. Unknown installed identity is shown as unreported; read failures do not imply
that the running service is unhealthy. Remote progress uses stages without a
fabricated percentage.

`ClientUpdateService` provides local relay/Electron discovery and preferences.
Its `client-updates.json` belongs to the local supervisor root or Electron userData,
never the selected AliceProject. Construction/status reads do not start network
work; GUI activation schedules it after paint. Discovery is single-flight and
retains the last observation after failure. `/relay/v1/updates` and the narrow
Electron bridge expose the same snapshot/commands. The old native check IPC is
removed. The shipped project field `autoCheckApp` remains the backend automatic
check preference; it is not migrated into a local client preference. Terminal
passive notices and the full execution coordinator still need consolidation.
