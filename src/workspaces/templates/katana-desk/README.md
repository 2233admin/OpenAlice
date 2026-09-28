---
version: 1.0.0
---

# Katana Desk

A read-only research desk wired to the katana kernel (a closed, separate
process) through a stdio MCP server. The agent gets live holdings, pending
acknowledgements, a close digest, market-environment reads, single-ticker
deep scans, data-pipeline health, and the research-lab registry — all
read-only. It never places, amends, or cancels a broker order.

## What this workspace does

katana stays a separate, closed process — its market-data lake, research
lab, and holdings/decision ledger ("the book") never run in-process inside
this workspace. This template only seeds:

- `.mcp.json` — a stdio MCP server declaration named `katana` that spawns
  the katana bridge (`scripts/bridge/mcp.py` in a katana-runtime checkout)
  per agent session.
- `.claude/skills/katana-desk/SKILL.md` and
  `.agents/skills/katana-desk/SKILL.md` — written for this template from
  scratch (not copied from any OpenAlice-shipped skill), teaching the agent
  which katana tool to use for which question, that every tool is
  read-only, and that the agent never places orders or edits receipt
  issues.

## Required setup: point `.mcp.json` at your katana-runtime checkout

`.mcp.json` ships with a placeholder path, not a machine-specific one:

```json
{
  "mcpServers": {
    "katana": {
      "command": "python",
      "args": ["<KATANA_RUNTIME_ROOT>/scripts/bridge/mcp.py"]
    }
  }
}
```

After creating a workspace from this template, edit `.mcp.json` in the new
workspace and replace `<KATANA_RUNTIME_ROOT>` with the absolute path to your
katana-runtime checkout (the directory containing `scripts/bridge/mcp.py`),
for example `D:/projects/k-atana-runtime`. This keeps the machine-specific
path out of the template source so the template stays portable across
hosts and shareable without leaking a local filesystem layout.

## Receipt issues live elsewhere — do not schedule them here

This workspace is for research and read-only lookups. Acknowledgement /
receipt decisions (ticking a hold / exit / revise-line checkbox on a
pending trigger) must happen in a separate, **agent-free** desk workspace —
one with no scheduled issues and no agent sessions configured — so an agent
can never forge a human authorization by editing an issue itself. Do not
add scheduled issues to a workspace created from this template if you
intend to use it for receipts; use a distinct desk workspace for that
instead, and keep this template's workspaces query-only.

## When to spawn this

- You want an agent to answer katana-backed questions (positions, digest,
  market environment, a deep read on one name, data health, the lab
  registry) without giving it any ability to write the book, the lake, or
  place a trade.
- You do NOT want this workspace used for receipt acknowledgements — spawn
  a separate agent-free desk workspace for that instead.

## Parameters

When spawning, you'll configure:

- **Tag** — short identifier for this workspace (lowercase, dashes ok).

After creation, edit `.mcp.json` to point at your katana-runtime checkout
before the `katana` MCP tools will work.
