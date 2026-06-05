# XartPro Linear Operating Standard v1

## Why This Exists

The user should not have to fight agents every day on project granularity.

Linear is the project control plane. Agents must create the right structure before creating work items.

## First Rule

Do not create Linear issues until the project complexity has been classified.

## Complexity Classes

### Class A: Quick Task

Use when:

- One owner.
- One repository.
- One narrow change.
- Can finish in one session.

Required Linear structure:

- Existing project, if applicable.
- One issue.
- Labels.
- Build/test note in comment.

Do not create:

- Initiative.
- Milestones.
- Many child tasks.

### Class B: Feature Track

Use when:

- Multiple files or modules.
- Needs design/build/QA separation.
- Could span several sessions.

Required Linear structure:

- Project.
- One parent issue.
- 3-7 child issues.
- Labels.
- Dependencies if order matters.

Optional:

- One milestone if the project already has milestone grouping.

### Class C: Complex Project

Use when:

- Multiple agents or machines.
- Upstream/fork sync.
- Design + implementation + QA.
- Cross-module architecture or product workflow.
- More than one phase.

Required Linear structure:

- Initiative.
- Project.
- Milestones/phases.
- Parent program issue.
- Child issues per phase.
- Dependency graph.
- Project update.
- Handoff issue.

This is the default for product rebuilds, multi-agent UI work, infrastructure rebuilds, and anything involving 5090/remote agents.

## Required Preflight

Before creating or changing issues, run:

```powershell
linear auth whoami
linear team list
linear project list
linear project view <project-slug-or-id>
linear milestone list --project <project-slug-or-id>
linear issue query --team <TEAM> --project <PROJECT> --sort priority --limit 50 --no-pager
linear issue query --team <TEAM> --search "<topic>" --limit 20 --json
```

If the project lookup only works by slug/id, record that slug/id in the issue or update.

## Project Structure Rules

### Team

Team is ownership boundary, not project grouping.

Example:

`XAR` can contain many projects. Do not rely on `XAR` alone as grouping.

### Project

Every non-trivial effort must attach to a project.

If no project exists, create or ask before creating issues.

### Initiative

Create an initiative for Class C work.

The initiative explains why the work exists across projects or phases.

### Milestone

Milestones are phase groupings inside a project.

Use ordered names:

- `00 Setup + Baseline`
- `01 Core Architecture`
- `02 Product Surface`
- `03 Integration`
- `04 Hardening + Release`

### Parent Issue

Parent issue is the execution spine.

It must contain:

- worktree/repo
- branch
- preview command
- owner map
- acceptance criteria
- handoff format

### Child Issues

Child issues must be actionable and phase-scoped.

Bad:

- "Improve frontend"
- "Make it better"

Good:

- "Composer focus and skill-chip motion pass"
- "Route sync guardrails for home/inbox/tracked"
- "Design tokens and reusable shell primitives"

## Multi-Agent Rules

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

## If Unsure

Default upward, not downward:

- If it might be Class C, structure it as Class C.
- It is cheaper to collapse a milestone than to reconstruct a project after agents already created scattered issues.
