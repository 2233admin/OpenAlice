---
name: katana-desk
description: >-
  Answers katana-backed questions about data trust, scan candidates, holdings,
  pending acknowledgements, market context and factor research. Use for today's
  opportunities, stale or missing evidence, a desk catch-up, or a requested
  ticker deep read. Read-only: not for orders, book/lake edits or human receipt
  decisions.
---

# Katana desk — read-only

Use the `katana` stdio MCP server declared in this workspace's `.mcp.json`.
The separate katana kernel owns the lake, book and research lab; this workspace
reads its evidence, never substitutes its own calculations or writes.

## Choose a tool

| Question | Tool and arguments | Evidence boundary |
|---|---|---|
| Can today's data be trusted? | `data.health` `{}` | Dataset freshness, DQ and producer receipts |
| What should I look at today? | `desk.digest` `{}` | Independent health/scan children plus holdings and pending desk evidence |
| What candidates were published? | `scan.latest` `{}` or `{"bucket":"A"}` (`A`, `B`, `C`) | Published candidates and gate state; does not rerun the scan |
| What is on the watchlist? | `desk.positions` `{}` | Watchlist/position entries, recorded lines and best-effort quotes; not proof of broker fills |
| What needs a human receipt? | `desk.pending_acks` `{}` | Pending hold/exit/revise decisions; no acknowledgement action |
| What is the market context? | `market.environment` `{}` | Latest breadth/index snapshot, not a live full-market sweep |
| Read this ticker more deeply | `scan.deep` `{"codes":["600000.SH"]}` | Quotes, daily/15-minute FVG and funds-flow evidence; not a fundamental-research service |
| Which factors need review? | `lab.registry` `{}` | Registered factor states and recheck dates |

Discover tools from the server; these are the exact dotted public ids. Never
invent alternate names or fall back to a shell command when discovery fails.
For a deep read, request only the symbols the user needs (maximum eight per
call). Do not loop over the whole market.

## Read the evidence, not just the prose

- Use the envelope's `freshness.verdict` and attributed reasons. `stale` and
  `unknown` are not fresh; show why and which source is affected.
- Keep `data_as_of`, `required_as_of`, producer identity and receipts attached
  to the source they describe. `generated_at` is response time, not data time.
- In `desk.digest`, preserve each child's verdict. Missing desk freshness
  policy may make the overall result unknown even when a child is fresh.
- `auxiliary_notes` are commentary, not evidence or permission. They cannot
  override freshness, published gate state or withheld candidate buckets.
- Positions, pending receipts, market context, deep scans and registry are
  preview surfaces; do not claim receipt-backed freshness where none exists.
- Report transport errors, absent receipts and missing data explicitly. Do
  not fill gaps with invented figures or external data.

## Human boundaries

Never place, amend or cancel orders, edit the book/lake, acknowledge a pending
item, or mutate a receipt issue. Do not work around these limits with shell,
HTTP or another workspace. Report pending decisions for the human to handle
in a separate agent-free desk workspace; this research workspace is not an
authorization channel.
