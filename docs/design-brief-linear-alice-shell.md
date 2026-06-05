# Linear Alice Shell Design Brief

## Goal

Build OpenAlice into a quiet, high-density AI workspace shell:

- Linear-grade navigation discipline.
- Obsidian-grade empty space and focus.
- Alice-native conversational center.
- ConfigUI/Nexus-style component precision, without turning into a dashboard collage.

Linear is the calibration ruler, not the product skin.

## Target Feeling

The first screen should feel like a serious agent workspace at 2 a.m.:

- Mostly dark, nearly black, with low-contrast borders.
- Large empty working area.
- One obvious object in the center: Ask Alice.
- Sidebar feels stable and tool-like, not decorative.
- Motion is restrained: fast, spatial, reversible.
- No marketing hero, no card pile, no red-as-brand, no loud gradients.

Use the current page at `/` as the baseline.

## Linear Alignment

Align with Linear on:

- Density: compact rows, small labels, no oversized headings inside the app shell.
- Rhythm: consistent 8px-ish spacing, aligned left rails, stable row heights.
- Surface hierarchy: black page, slightly lifted panels, subtle dividers.
- Interaction states: hover/active are quiet, not glowing buttons.
- Command center pattern: central prompt, lightweight tool chips, clear submit affordance.

Do not copy Linear on:

- Brand color or exact icons.
- Issue/project information architecture.
- Marketing copy.
- The exact tab/chrome layout if it fights OpenAlice's workspace model.

## Current Baseline

Branch:

`feature/linear-alice-shell-latest`

Worktree:

`D:\projects\OpenAlice-linear-latest`

Run:

```powershell
pnpm -C ui dev:design
```

Preview:

`http://127.0.0.1:5173/`

Verification:

```powershell
pnpm -C ui build
git diff --check
```

## Safe Experiment Zones

Prefer new files first:

- `ui/src/components/visual-lab/*`
- `ui/src/components/motion/*`
- `ui/src/components/composer/*`

Touch carefully:

- `ui/src/components/EmptyEditor.tsx`
- `ui/src/components/ActivityBar.tsx`
- `ui/src/components/TabHost.tsx`
- `ui/src/components/TabStrip.tsx`
- `ui/src/index.css`

Avoid unless coordinated:

- `ui/src/tabs/UrlAdopter.tsx`
- `ui/src/tabs/store.ts`
- `ui/src/i18n/locales/*`
- auth, backend, workspace data model.

## Motion Direction

Motion should support cognition:

- Composer focus: tiny elevation and border change.
- Sidebar hover: short color/opacity transition only.
- Route changes: light fade or slide, under 180ms.
- Tool chips: tactile but not playful.
- No bouncy SaaS animation.
- No particle/orb background.

GSAP is acceptable for orchestrated shell transitions, but CSS transitions are better for simple hover/focus states.

## Next Design Passes

1. Composer
   - Focus state.
   - Skill menu affordance.
   - Attachment affordance.
   - Submit state.

2. Sidebar
   - Better active row.
   - Workspace/account switcher polish.
   - Section spacing and collapse motion.

3. Workspace Shell
   - Tab strip density.
   - Empty canvas watermark.
   - Inbox and Tracked pages under the same visual grammar.

4. Motion
   - Page mount/unmount.
   - Composer interaction.
   - Sidebar open/collapse.

## Handoff Format

Each experiment should report:

```text
branch:
commit:
changed files:
preview URL:
screenshot path:
what changed:
what still feels wrong:
```

Keep commits small. One visual idea per commit.
