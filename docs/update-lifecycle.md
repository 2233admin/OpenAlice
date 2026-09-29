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

## Current migration boundary

`useUpdateLifecycle` remains the production UI facade. Real version discovery and
rehearsal share selection and discovery state, but project/SSH scheduling, native
subscription consolidation, operation journals and the rehearsal execution
reducer still need migration. The Workspace `/updates/check` endpoint still has
the historical automatic-apply behavior; it is not a reader for DiscoveryStore.
Do not infer full lifecycle or real installation acceptance from discovery tests.
New work should advance the canonical plan rather than introduce another public
hook or independently implemented selection/request-ordering rule.
