## Scope

Visual and build verification for the Linear Alice Shell track.

## Required Checks

- `pnpm -C ui build`
- `git diff --check`
- Browser smoke:
  - `/` shows Ask Alice composer.
  - `/inbox` opens and syncs URL.
  - Returning to `/` clears the focused tab and shows home.
  - Demo snapshot banner is absent unless explicitly enabled.
  - `Tracked` remains visible in nav.

## Evidence

Record:

- command outputs
- preview URL
- screenshot/capture path when available
- branch and commit hash
