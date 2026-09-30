# Testing

This guide owns the developer-facing test taxonomy, command namespace, and
side-effect contract. It does not replace the surface-specific acceptance
guides: use this guide to select the right lane, then follow the owning guide
for browser, Electron, Docker, remote-host, installer, or broker evidence.

The catalog and selector live in `scripts/test-lanes.mjs` and
`scripts/run-tests.mjs`. Vitest projects remain execution environments; the
public commands describe product ownership and risk instead of exposing that
internal topology.

After a fresh install, the full suite's native CLI subprocess fixtures need
the compiled `@traderalice/update-lifecycle` entry point:

```bash
pnpm -F @traderalice/update-lifecycle build
pnpm test
```

Vitest aliases workspace packages to source in its own process. Real CLI
children use package exports and do not inherit those aliases. This local
build prerequisite does not grant any external or broker acceptance authority.

## Product Evidence Groups

Product journeys live under `tests/scenarios/<scenario>/`; protocol and
cross-folder workflow requirements live under `tests/contracts/<boundary>/`.
Each directory's `coverage.json` feeds the existing catalog with required
behaviors, assertion/command evidence, priorities, fidelity, environment
limits, and explicit gaps. Leaf unit/component specs remain with their code.
See [[tests/README.md]] ([group catalog](../tests/README.md)) for the complete
map and maintenance contract.

```bash
pnpm test:groups
pnpm test:groups --scenario desktop-lifecycle --explain
pnpm test:groups --contract alice-uta --json
pnpm test:inventory --json
pnpm test:select --scenario workspace-creation --lane integration
pnpm test:select --scenario first-run --contract alice-uta --owner alice --explain
```

`--scenario` and `--contract` select referenced spec evidence and compose with
existing dimensions: OR within a dimension, AND between dimensions. The lane
still defaults to hermetic. Dedicated system/Electron/installer/paper commands
are shown as additional evidence with their own prerequisites; the generic
selector never executes them on behalf of a group. A group with no executable
specs in the selected lane fails closed. Use `--groups` to inspect such a
group's missing behaviors or argument-bearing dedicated commands.

`test:groups` is a data-only view of requirements, including missing/partial
evidence; `test:inventory` is the complete unfiltered spec and command inventory.
An owner-only leaf spec is accounted for without inventing a product coverage
claim. Mapped evidence is not a run result; a green component check is not a
native user journey. Catalog guards validate assertion/task references and
central ownership. Metadata changes force collection-wide changed-test reruns.

## Command Model

Start with the narrowest command that can falsify the change, then escalate
when the dependency or ownership boundary is uncertain.

| Namespace | Meaning |
|---|---|
| `pnpm test` | Complete default hermetic catalog across Node and UI. This is the deterministic full-suite backstop, not every test-like operation in the repository. |
| `pnpm test:changed` | Hermetic tests in Vitest's static changed-file dependency closure against `origin/dev`. |
| `pnpm test:owner:*` | Complete hermetic inventory for one product owner. |
| `pnpm test:integration:*` | Deterministic local product integration with isolated state; no public network, configured account, or trading write. |
| `pnpm test:contract:*` | Named hermetic contracts whose ownership crosses implementation folders, such as workflow or platform behavior. |
| `pnpm test:system:*` | Dedicated process, host, Docker, installer, or artifact acceptance. These commands are never part of `pnpm test`. |
| `pnpm test:external:*` | Explicit read-only access to public services, configured providers, or local TWS. |
| `pnpm test:live:*` | Explicit demo/paper account acceptance that can submit, cancel, close, or otherwise mutate broker state. |
| `pnpm test:select` | Composable catalog query and advanced Vitest entry point. |
| `pnpm test:groups` | Data-only product scenario/protocol requirement and gap inspection. |
| `pnpm test:inventory` | Complete data-only spec, manifest-check, and registered standalone acceptance inventory. |

The owner suites are:

| Owner | Command | Scope |
|---|---|---|
| Alice | `pnpm test:owner:alice` | Core/domain/server/tool code and Alice-owned shared packages |
| UI | `pnpm test:owner:ui` | Browser UI |
| UTA | `pnpm test:owner:uta` | UTA service, protocol, broker packages, and IBKR package |
| Connector | `pnpm test:owner:connector` | Connector Service and Connector protocol |
| Runtime/CLI | `pnpm test:owner:runtime-cli` | Workspace Runtime, native CLI, and Guardian runtime |
| Desktop | `pnpm test:owner:desktop` | Electron desktop shell |
| Repository tooling | `pnpm test:owner:repo-tooling` | Build, test, release, and repository scripts |

Use `pnpm test:integration` for every deterministic local integration spec, or
`test:integration:workspace` / `test:integration:uta` for the named surface.
The stable cross-folder contracts are `test:contract:workflow`,
`test:contract:platform`, and `test:contract:connector-replay`.

System commands intentionally expose their prerequisite and artifact boundary:

| Command | Boundary |
|---|---|
| `pnpm test:system:dev-stack` | Starts a real temporary local development process tree. |
| `pnpm test:system:guardian` | Starts and kills test-owned Guardian process trees. |
| `pnpm test:system:connector` | Starts a built Connector Service against test-owned state. |
| `pnpm test:system:installer` | Builds disposable Docker images and exercises the checked-out installer payload. |
| `pnpm test:system:installer:dev` | Downloads the current dev installer and uses disposable Docker images. This command requires network access and a published dev candidate. |
| `pnpm test:system:remote` | Creates a disposable Docker/SSH target and transfers a built or selected CLI payload. |

Some acceptance commands primarily own an artifact lifecycle rather than a
test selection. Keep their established owner namespace instead of adding a
decorative `test:*` alias: examples include `pnpm electron:smoke:*`, Electron packing, Broker Pack acceptance, and release
candidate builders. Likewise, the package-manager artifact smoke requires
explicit artifact arguments and is not a parameterless root test command.

## Composable Selection

Use the stable aliases above for normal work. Use `test:select` when a change
needs an intersection that does not deserve another permanent package script:

```bash
pnpm test:select --owner ui --changed origin/dev
pnpm test:select --owner uta --package @traderalice/uta-service
pnpm test:select --lane integration --area workspace
pnpm test:select --lane external-readonly --area market-data --explain
pnpm test:select --owner alice --path src/server -- --reporter=verbose
```

Selectors in one dimension are ORed; different dimensions are ANDed. For
example, two `--owner` values select either owner, while `--owner uta
--package @traderalice/uta-service` selects only the package portion of that
owner. Supported dimensions are `--lane`, `--owner`, `--area`, `--package`,
repo-relative `--path`, `--scenario`, and `--contract`. `--changed [base]` intersects the candidates at
execution using Vitest's static import graph. The default lane is `hermetic`,
and a zero-file result fails closed rather than pretending that nothing was a
pass.

`--list`, `--explain`, and `--json` are dry-run modes. They enumerate catalog
selection, side effects, prerequisites, and the planned invocation without
loading a test module, probing credentials, or proving that those prerequisites
exist. Arguments after `--` are forwarded to Vitest.

Docker fixtures under `scripts/` are disposable installer and SSH test hosts;
they are not supported deployment images. OpenAlice does not ship a backend
Dockerfile, Compose recipe, or container supervisor.

The generic selector does not execute the `system` inventory; use the matching
`test:system:*` command. Run `pnpm test:select --help` for the live catalog.

## Side Effects and Acceptance

Lane names are safety contracts:

| Lane | Allowed effects | Acceptance rule |
|---|---|---|
| Hermetic | Temporary local files and test-owned subprocesses only | Every selected spec passes in isolated repository state. |
| Integration | Temporary local files and test-owned local processes only | Every selected deterministic product journey runs and passes. |
| System | Only the host/container/network effects documented by the dedicated command | The command's prerequisites are present and its complete owned journey passes and cleans up. |
| External read-only | Network reads and the selected spec's documented local configuration; never an order write | At least one intended external scenario actually runs and passes. |
| Live paper | Network access and writes to verified demo/paper accounts | The selected scenario runs, passes, and the account returns to its pre-run positions/orders baseline even after failure. |

An external or live command that skips every selected test is **not run**, not
accepted. Missing Docker, network access, credentials, TWS, a published dev
candidate, or another prerequisite is a reported gap; an unrelated green lane
does not replace it.

Every live command requires `OPENALICE_UTA_LIVE_PAPER=1`. Before setting it,
verify the exact selected account is demo/paper and record its positions and
open orders. Prefer a provider command such as
`test:live:ibkr-paper`, `test:live:bybit-paper`, `test:live:okx-paper`,
`test:live:alpaca-paper`, or `test:live:hyperliquid-paper`.
`test:live:uta-paper` is the configured provider sweep.

`test:live:bybit-diagnostic` is deliberately separate: it performs a raw
market buy and only a best-effort close. It is never selected by the UTA paper
sweep and must not be used as routine live acceptance. Follow
[[docs/uta-live-testing.md]] for account safety and cleanup.

## Package-Local Tests

A workspace package's `test` script means that package's hermetic specs only:

```bash
pnpm -F @traderalice/openalice-cli test
pnpm -F @traderalice/uta-service test
```

It must not recursively run sibling packages or the complete product owner.
Conversely, an owner suite may cross several packages and application roots.
Use `test:select --package <workspace-name>` when combining a package boundary
with an owner, area, changed graph, or non-hermetic lane.

Package-local external or live scripts must route through the same root lane
and acknowledgement contract. The presence of a credential or reachable broker
must never silently turn a package's ordinary `test` into external or trading
acceptance.

## Adding or Moving a Test

1. Decide its side-effect lane before choosing a filename. Ordinary isolated
   specs are hermetic; deterministic product journeys are integration; public
   reads are external; account writes are live; host/artifact journeys are
   system tests.
2. Keep leaf specs under exactly one owner root. A central scenario/contract
   spec instead declares exactly one owner/lane/area/package association in its
   group's `centralTests` and an evidence row. Add a focused catalog include or
   exclusion in `scripts/test-lanes.mjs` when filename and location do not
   express the lane or named area unambiguously.
3. Keep the default environment isolated. Never hide a public request,
   configured-home read, Docker dependency, or broker write behind a skip in
   the hermetic catalog.
4. Add a named root alias only for a durable owner, risk, contract, or system
   boundary that developers will select repeatedly. One-off intersections use
   `test:select`; artifact builders keep their owning command namespace.
5. Update package-local scripts when the package contract changes, then run
   `pnpm test:contract:workflow`. Its catalog contract requires every collected
   spec to have exactly one owner and one lane and protects the root command
   namespace.
6. Run the selected lane plus the owning typecheck and real surface. Escalate to
   `pnpm test` when the change crosses owners, changes shared test/build
   infrastructure, or cannot be bounded confidently.

Do not create a new Vitest project merely to obtain a product label. Add or
change execution environments only when isolation or runtime behavior actually
requires one.
