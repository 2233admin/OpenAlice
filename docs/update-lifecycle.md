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

## Current migration boundary

Project/SSH orchestration and operation journals still need migration into the
shared coordinator; the rehearsal execution reducer is still separate. Client
versus project preference authority and frontend-host discovery are still open.
Do not infer full lifecycle or real installation acceptance from discovery or
IPC-mock tests. Advance the canonical plan rather than introduce another public
hook or independent request-ordering rule.
