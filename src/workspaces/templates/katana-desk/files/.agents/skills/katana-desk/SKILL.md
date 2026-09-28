---
name: katana-desk
description: >
  Use when a question needs live katana kernel data: current holdings, open
  pending acknowledgements, the close digest, overall market breadth/margin
  conditions, a deep read on one ticker, data-pipeline health, or the
  research/factor lab registry. All katana tools in this workspace are
  read-only; never use them to place, modify, or cancel a broker order, and
  never use them to edit a receipt/acknowledgement issue.
---

# katana desk (read-only)

This workspace is wired to the katana kernel through a stdio MCP server
named `katana`, declared in this workspace's `.mcp.json`. katana is a
separate, closed process: it owns the market-data lake, the research lab,
and the holdings/decision ledger ("the book"). This workspace only ever
*reads* from it through the tools below.

## Available tools

- `desk_positions` — current holdings from the book: symbol, size, cost
  basis, and any recorded invalidation line. Use for "what do we hold",
  "what's our line on X".
- `desk_pending_acks` — open acknowledgement requests waiting on a human
  decision (e.g. a position below its invalidation line). Use to check
  whether anything needs the principal's attention right now.
- `desk_digest` — the latest close/session digest: what happened, what
  changed, what's flagged. Use for "what happened today", "catch me up".
- `market_environment` — breadth, index levels, sector rotation, margin
  conditions as of the latest snapshot. Use for market-context questions
  that are not about one specific name.
- `scan_deep(code)` — a detailed read on a single ticker (fundamentals,
  technicals, recent research notes). Bounded to one symbol at a time; do
  not loop this across the whole market — it is not a substitute for a
  full-market scan and repeated calls can throttle the underlying data
  source.
- `data_health` — pipeline/data-freshness status: what's stale, what's
  missing, what failed to ingest. Use when a number looks wrong or old.
- `lab_registry` — the research/factor lab's current registry: active
  factors, recent backtests, retired ("graveyard") ideas. Use for "have we
  tried this before".

## Hard rules

- **Read-only, always.** None of these tools can place, amend, or cancel a
  broker order, and none of them can write to the book, the lake, or the
  research lab. If a task seems to require a write, stop and say so instead
  of improvising a workaround (e.g. shelling out to a script that writes
  those stores).
- **Never edit a receipt/acknowledgement issue.** Pending acknowledgements
  surfaced by `desk_pending_acks` are resolved by a human, in a separate,
  agent-free desk workspace — not by editing this workspace's issues, and
  not by editing that other workspace's issues from here. Report what is
  pending; do not try to resolve it.
- **Treat `scan_deep` as expensive.** One symbol per call, only when a
  human actually needs that depth. Do not use it to reconstruct a
  full-market scan.
- If a katana tool call errors or the MCP server is unreachable, say so
  plainly — do not fabricate figures to fill the gap.
