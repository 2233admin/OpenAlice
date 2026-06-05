## Scope

Claude 5090 visual/motion experiment track.

## Read First

`docs/design-brief-linear-alice-shell.md`

## Safe Experiment Zones

- `ui/src/components/visual-lab/*`
- `ui/src/components/motion/*`
- `ui/src/components/composer/*`

## Work

- Composer focus/elevation states.
- Skill chip and attachment affordance motion.
- Sidebar hover/active micro-interactions.
- Optional route/shell transition experiments under 180ms.

## Do Not Touch Without Coordination

- `ui/src/tabs/UrlAdopter.tsx`
- `ui/src/tabs/store.ts`
- `ui/src/i18n/locales/*`
- backend/auth/data model.

## Handoff

Each pass must include:

- branch
- commit
- changed files
- preview URL
- screenshot or short capture path
- what changed
- what still feels wrong
