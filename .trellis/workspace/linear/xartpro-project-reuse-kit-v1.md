# XartPro Project Reuse Kit v1

## Why This Exists

The user should not have to fight agents every day on project granularity.

This is a reusable Linear project kit. It exists so future projects can copy a known working structure instead of rebuilding the wheel.

It is not a workspace-wide lockdown, compliance sweep, or mandatory migration.

## Reference Implementation

OpenAlice is the current reference project.

Use it as the working example for:

- project spine
- Linear Documents
- phase milestones
- parent/child issue shape
- multi-agent handoff
- design/build/QA separation
- evidence posted back to Linear

Do not clone OpenAlice blindly. Copy the shape only when the project has the same complexity.

## First Rule

Before creating new Linear structure, classify the work.

The classification decides how much structure to reuse.

## Reuse Scoring

Use scoring only to decide how much of the kit to reuse.

This is not a project value score.

Score each dimension from 1-5:

- Complexity: modules, repos, phases, upstream/fork risk.
- Coordination risk: number of agents, machines, teams, handoff points.
- Reuse payoff: how much future setup friction the kit removes.

Guide:

- 3-5 total: Class A.
- 6-10 total: Class B.
- 11-15 total: Class C.

If a project has low current activity but high future complexity, score the next active phase, not the stale backlog.

## Complexity Classes

### Class A: Quick Task

Use when:

- One owner.
- One repository.
- One narrow change.
- Can finish in one session.

Reuse only:

- one existing project if applicable
- one issue
- labels
- build/test note in a comment

Do not create:

- initiative
- milestones
- many child tasks
- project-wide docs

### Class B: Feature Track

Use when:

- Multiple files or modules.
- Needs design/build/QA separation.
- Could span several sessions.

Reuse:

- project
- one parent issue
- 3-7 child issues
- labels
- dependencies if order matters
- short handoff comment

Optional:

- one milestone if the project already uses milestone grouping
- one Linear Document if the context needs to survive across agents

### Class C: Complex Project

Use when:

- Multiple agents or machines.
- Upstream/fork sync.
- Design + implementation + QA.
- Cross-module architecture or product workflow.
- More than one phase.

Reuse the full kit:

- initiative
- project
- Linear Documents
- milestones/phases
- parent program issue
- child issues per phase
- dependency graph
- project update
- handoff/QA issue

This is the right shape for product rebuilds, multi-agent UI work, infrastructure rebuilds, and anything involving 5090/remote agents.

## Reusable Preflight

Before creating or changing project structure, run:

```powershell
linear auth whoami
linear team list
linear project list
linear project view <project-slug-or-id>
linear milestone list --project <project-slug-or-id>
linear issue query --team <TEAM> --project <PROJECT> --sort priority --limit 50 --no-pager
linear issue query --team <TEAM> --search "<topic>" --limit 20 --json
```

If the project lookup only works by slug/id, record that slug/id in the parent issue or project update.

## Reusable Surfaces

### Team

Team is ownership boundary, not project grouping.

Example:

`XAR` can contain many projects. Do not rely on `XAR` alone as grouping.

### Project

Every non-trivial effort should attach to a project.

If no project exists, create or ask before creating issues.

### Linear Documents

Use Documents for durable context that another agent must read before touching work.

Good document types:

- agent alignment
- design brief
- architecture brief
- source-of-truth map
- release/handoff note

### Initiative

Use initiative only for Class C work.

The initiative explains why the work exists across projects or phases.

### Milestones

Milestones are phase groupings inside a project.

Reusable names:

- `00 Setup + Baseline`
- `01 Core Architecture`
- `02 Product Surface`
- `03 Integration`
- `04 Hardening + Release`

Rename them to match the product. Keep the numbering if ordering matters.

### Parent Issue

Parent issue is the execution spine.

It should contain:

- worktree/repo
- branch
- preview command
- owner map
- acceptance criteria
- handoff format
- links to required Linear Documents

### Child Issues

Child issues must be actionable and phase-scoped.

Bad:

- "Improve frontend"
- "Make it better"

Good:

- "Composer focus and skill-chip motion pass"
- "Route sync guardrails for home/inbox/tracked"
- "Design tokens and reusable shell primitives"

## Multi-Agent Reuse

Every external agent gets:

- one Linear issue
- one branch
- safe files/directories
- forbidden files/directories
- required handoff format

Required handoff:

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

Agents must not share a dirty worktree.

## Done Means

For implementation issues:

- code changed
- build/test command run
- evidence posted to Linear
- affected branch recorded
- screenshot or preview URL posted for UI work

For planning issues:

- structure exists
- dependencies are set
- next owner can start without asking the user for granularity

## Anti-Patterns

Do not:

- retrofit every project just because this kit exists
- create initiatives for one-session work
- split tiny tasks into fake phase trees
- let agents create loose issues outside the project
- treat `XAR` as enough grouping
- leave design context only in chat logs

## If Unsure

Reuse upward only when complexity demands it.

The goal is less repeated coordination, not more Linear furniture.
