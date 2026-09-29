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

## Current migration boundary

`useUpdateLifecycle` is still the production UI provider, and the rehearsal now
uses the same selection decisions as real discovery. Probe scheduling, native
subscriptions, operation journals and the rehearsal execution reducer have not
been unified yet. Do not infer full lifecycle or real installation acceptance
from shared selection tests. New work should advance the canonical plan rather
than introduce another hook or independently implemented selection rule.
