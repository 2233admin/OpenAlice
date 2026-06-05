## Scope

Keep the OpenAlice UI branch riding latest upstream while preserving the Linear Alice Shell work.

## Work

- Rebase `feature/linear-alice-shell-latest` onto `origin/master` before significant design passes.
- Keep upstream i18n structure intact.
- Keep `Tracked` and other upstream UI additions wired.
- Protect route/store boundaries while `/` becomes the Ask Alice home.
- Maintain `dev:design` as the visual iteration command.

## Acceptance

- `pnpm -C ui build` passes after every upstream sync.
- `git diff --check` passes.
- No unrelated old worktree changes are imported.
- OpenAlice project Linear issues reflect active branch/status.
