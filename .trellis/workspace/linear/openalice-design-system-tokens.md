## Scope

Turn the current visual direction into maintainable theme/component primitives.

## Work

- Audit dark shell color tokens in `ui/src/index.css`.
- Separate durable tokens from one-off component colors.
- Extract repeatable composer/sidebar/shell primitives only when the duplication is real.
- Keep i18n keys in catalog and avoid hard-coded UI strings.
- Document what counts as OpenAlice brand vs Linear reference.

## Acceptance

- No one-off visual constants spread across many files without reason.
- Component boundaries stay small and readable.
- Existing `home.*` i18n keys remain typed across en/zh/ja.
- Visual changes can be reviewed from diff and browser preview.
