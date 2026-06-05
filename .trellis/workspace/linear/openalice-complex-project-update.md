OpenAlice frontend is now treated as a long-running rebuild track, not a quick visual task.

Structure:

- Initiative: OpenAlice Frontend Rebuild
- Project: OpenAlice
- Milestones:
  - 00 Upstream Fork + Program Setup
  - 01 Shell Baseline + Density
  - 02 Composer + Motion Lab
  - 03 Workbench Canvas + Page Parity
  - 04 Hardening + Release Handoff

Issue spine:

- XAR-709 parent/program issue
- XAR-710 upstream sync + i18n guardrails
- XAR-713 density pass
- XAR-715 design tokens + reusable shell primitives
- XAR-711 Claude 5090 motion experiments
- XAR-714 workbench canvas + page parity model
- XAR-712 QA/handoff

Dependency rule:

- XAR-710 blocks design implementation tracks.
- Density, motion, canvas, and tokens all block final QA/handoff.

This gives Codex and Claude 5090 a real roadmap instead of a loose pile of tasks.
