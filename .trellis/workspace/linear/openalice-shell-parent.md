## Intent

Build the next OpenAlice frontend on the latest upstream fork baseline, with Linear as the project coordination surface and the current `Linear Alice Shell` as the design spine.

This is not "copy Linear". Linear is the workflow and density reference. OpenAlice stays Alice-native: conversational center, agent workspace, quiet dark shell, i18n-compatible frontend.

## Current Baseline

- Worktree: `D:\projects\OpenAlice-linear-latest`
- Branch: `feature/linear-alice-shell-latest`
- Upstream base: `origin/master da3f130`
- Preview command: `pnpm -C ui dev:design`
- Preview URL: `http://127.0.0.1:5173/`
- Design brief: `docs/design-brief-linear-alice-shell.md`

## Collaboration Model

- Codex owns upstream sync, i18n safety, integration, build verification, and route/store boundaries.
- Claude 5090 owns motion and visual experiments in safe component zones.
- GitHub branch + Linear issue is the sync surface. Screenshot/video is the visual acceptance surface.

## Acceptance

- Latest upstream i18n stays intact.
- `/` opens the Ask Alice shell.
- Demo data works without the snapshot banner.
- `Tracked` and existing OpenAlice routes remain accessible.
- `pnpm -C ui build` passes.
- `git diff --check` passes.
