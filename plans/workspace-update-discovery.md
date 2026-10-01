# Workspace discovery owns update status

Status: implementing; serial delivery. Issue #1711.

Owner guides: update-lifecycle, workspace-template-upgrade, testing, development-workflow.

Decision: reuse WorkspaceUpdateService for the three persisted default Workspaces,
including Chat. Overview and guidance consume check observations only. Plans are
requested by review or authorized automatic execution for an observed target;
plan errors never become discovery errors. Keep existing three-row UI and primitives.

- [x] Default-only metadata checks and Chat support; separate check/review/apply failures.
- [x] Remove provider plan prefetch/projection; bind explicit reviews to observed targets.
- [x] Preserve cache invalidation, default/connection fences and exact apply validation.
- [ ] Update demo and behavior regressions; root/UI typechecks, full suite, real browser and Electron.
- [ ] Update owner guide, integrate one dev PR, close #1711 and remove this plan.

No remote deployment, release or user Workspace upgrade is authorized by this change.

Acceptance so far: 50 focused tests and 13 review-panel tests pass; root/UI
typechecks and Electron build pass. Browser demo check→review→apply→current
and original-config Electron current source Workspaces verified. Full suite
initially found 12 stale panel mocks; corrected them, final rerun pending.
Remote stable 0.94.1 lacks Chat discovery; it remains unknown until backend update.
