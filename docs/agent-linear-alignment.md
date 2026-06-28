# Agent Linear Alignment

Before doing OpenAlice work, read the Linear project structure.

## Required Linear Context

- Initiative: `OpenAlice Frontend Rebuild`
- Project: `OpenAlice`
- Current program parent: `XAR-709`
- Current phases:
  - `00 Upstream Fork + Program Setup`
  - `01 Shell Baseline + Density`
  - `02 Composer + Motion Lab`
  - `03 Workbench Canvas + Page Parity`
  - `04 Hardening + Release Handoff`

## Required Preflight

```powershell
linear auth whoami
linear project view 063c0412496d
linear milestone list --project 063c0412496d
linear issue view XAR-709
linear issue query --team XAR --project OpenAlice --sort priority --limit 30 --no-pager
```

## Working Rule

Do not create loose issues for complex work.

For OpenAlice frontend, use the existing milestone and parent issue:

- Program parent: `XAR-709`
- Upstream/i18n guardrails: `XAR-710`
- Motion experiments: `XAR-711`
- QA/handoff: `XAR-712`
- Density pass: `XAR-713`
- Workbench canvas/page parity: `XAR-714`
- Tokens/primitives: `XAR-715`

## Handoff Rule

Every agent pass must report:

```text
Linear issue:
branch:
commit:
changed files:
preview URL:
screenshot/capture:
what changed:
what still feels wrong:
build/check result:
```
