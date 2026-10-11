# Katana Desk

A read-only research workspace for Claude Code and Codex. It consumes a separate
k-atana installation; it does not install the kernel, start trading services or
create market data. Both agents receive the same `katana-desk` skill.

## Connect your kernel

1. Prepare a k-atana installation exposing the eight dotted MCP tool ids below.
   The Phase 1 contract is available in
   [k-atana commit eaf7b080](https://github.com/2233admin/k-atana/commit/eaf7b080bbae25b446e481a3bd275325f10948c8).
   Its Python/uv runtime and required data must already be available.
2. Set `KATANA_RUNTIME_ROOT` to that installation's absolute root in the
   environment used to start OpenAlice, then create a **Katana Desk** workspace.
   Windows paths, spaces and quotes are serialized into valid JSON.
3. If the variable was unset, replace every `<KATANA_RUNTIME_ROOT>` in the
   generated `.mcp.json` before starting an agent. The placeholder is deliberate;
   there is no alternate server or synthetic-data fallback.
4. The MCP launcher uses `python` from the agent's PATH to run the kernel's
   `scripts/katana_uv.py`, select its `backend` project and start
   `scripts/bridge/mcp.py`. Check that the selected Python and kernel environment
   are available to the same account running OpenAlice.

The bootstrap only copies the skill/configuration and initializes the workspace
repository. It does not fetch dependencies or write to the kernel's book/lake.

## Ask for evidence

Start with “Can I trust today's data, and what opportunities were published?”
The consumer uses `data.health`, `desk.digest` and `scan.latest`. Other available
read-only tools are `desk.positions`, `desk.pending_acks`, `market.environment`,
`scan.deep` and `lab.registry`.

Use the server's exact dotted ids. `scan.latest` optionally takes bucket `A`,
`B` or `C`; `scan.deep` takes a `codes` array with at most eight requested symbols.
The workspace skill contains the complete tool-selection guide.

A response timestamp does not prove current data. Preserve each source's
`data_as_of`, required date, freshness verdict and producer receipt. Missing
receipts, unavailable calendars and absent datasets must remain explicit
`unknown`/`stale` evidence; do not invent results or treat auxiliary commentary
as a producer receipt. Preview tools do not acquire receipt-backed freshness
merely by appearing in a desk response.

## Agent configuration and limits

The template disables OpenAlice's automatic MCP/persona injection and supplies
only the katana MCP definition. Claude reads the workspace MCP configuration.
The Codex adapter translates that configuration for interactive and headless
launches and disables its implicit `openalice` / `openalice-workspace` servers
when the workspace omits them. A malformed present configuration stops launch;
only an absent file retains the adapter's legacy defaults.

This is **not a security sandbox**. Codex merges overrides with its existing
configuration: unrelated operator MCP servers, same-transport optional settings,
authentication, model selection and shell capabilities are not removed. A
same-name HTTP/stdio conflict is rejected by Codex; resolve the conflicting name
in the operator configuration rather than bypassing the failure. An empty
workspace server map disables the adapter's OpenAlice defaults, not every
operator-configured server.

Supported Codex workspace definitions are stdio (`command`, optional `args` and
`env`) and HTTP (`type: "http"` or `"streamable-http"`, `url`, optional `headers`).
`${VAR}` and `${VAR:-fallback}` resolve against the final spawn environment;
missing required variables and unsupported fields are errors. Explicit `env`
and `headers` values become CLI configuration arguments and may be visible to
local process inspection. This template contains no credentials; do not put
secrets into it expecting command-line secrecy.

Never place/change/cancel orders, acknowledge desk decisions, mutate receipt
issues or edit the book/lake through this research workspace. Do not substitute
shell/HTTP calls when MCP discovery or evidence is unavailable. Human decisions
belong in a separate agent-free desk workflow.
