# 5090 Development Handoff

This is the handoff for continuing the OpenAlice frontend rebuild on the 5090 dev box.

## Source Of Truth

- Upstream base: `TraderAlice/OpenAlice` at `v0.40.0-beta.1`
- Our development branch: `2233admin/OpenAlice`, branch `feature/openalice-dev`
- Current branch tip: check with `git log -1 --oneline` after checkout.
- Local working repo on this host: `D:\projects\OpenAlice-linear-latest`
- Clean upstream comparison repo on this host: `D:\projects\OpenAlice-latest`

Do not use demo mode for functional QA. Demo mode is only for static visual comparison.

## Clone On 5090

```powershell
git clone https://github.com/2233admin/OpenAlice.git
cd OpenAlice
git checkout feature/openalice-dev
pnpm install --frozen-lockfile
pnpm dev
```

The real dev stack starts UTA, Alice backend, MCP, and Vite. Watch the guardian log for the exact ports.

## Deterministic Ports

`pnpm dev` supports fixed port starts:

```powershell
$env:OPENALICE_WEB_PORT_START='47331'
$env:OPENALICE_UTA_PORT_START='47333'
$env:OPENALICE_UI_PORT_START='5173'
pnpm dev
```

Use this when several OpenAlice checkouts are running on the same machine. It avoids the `localhost` / `127.0.0.1` port collision that makes one UI talk to the wrong backend.

## A/B Development

For side-by-side testing, keep two checkouts:

- A original: upstream `TraderAlice/OpenAlice`, no local UI changes
- B modified: `2233admin/OpenAlice:feature/openalice-dev`

From the modified checkout:

```powershell
.\scripts\dev-ab.ps1 start
.\scripts\dev-ab.ps1 status
.\scripts\dev-ab.ps1 stop
```

Default URLs:

- B modified: `http://127.0.0.1:5173`
- A original: `http://127.0.0.1:5174`

The script starts B through the modified guardian. It starts A from the clean upstream source tree directly, with fixed A ports: backend `47431`, MCP `47432`, UTA `47433`, and UI `5174`. This keeps the A frontend original while avoiding Windows `localhost` IPv4/IPv6 port splitting.

If the original checkout is not in the default sibling path, pass it explicitly:

```powershell
.\scripts\dev-ab.ps1 start -OriginalRepo D:\projects\OpenAlice-latest
```

## Smoke Checks

```powershell
Invoke-RestMethod http://localhost:47331/api/auth/status
Invoke-RestMethod http://127.0.0.1:47333/__uta/health
Invoke-RestMethod 'http://localhost:47331/api/workspaces/templates'
Invoke-RestMethod 'http://localhost:47331/api/workspaces/agents'
Invoke-RestMethod 'http://localhost:47331/api/market/search?query=AAPL&limit=5'
```

Expected:

- Auth returns `authed: true` with `passthrough: localhost` in local dev.
- UTA health returns `ok: true`.
- Workspace templates include `chat`, `auto-quant`, and `finance-research`.
- Agents include `claude`, `codex`, `opencode`, `pi`, and `shell`.
- AAPL search returns Apple.

## Current Frontend Direction

The first screen is a Linear-style Alice shell:

- `Ask Alice` is the root surface.
- The sidebar is compact and work-focused.
- Empty editor is a central composer, not onboarding copy.
- Root `/` intentionally clears tabs and sidebars in the modified branch.
- The modified branch has direct home entry points: the top tab toolbar Home icon and the left `OpenAlice` brand both return to `Ask Alice`.

Relevant files:

- `ui/src/components/EmptyEditor.tsx`
- `ui/src/components/ActivityBar.tsx`
- `ui/src/components/TabHost.tsx`
- `ui/src/components/TabStrip.tsx`
- `ui/src/tabs/UrlAdopter.tsx`
- `ui/src/index.css`
- `ui/src/i18n/locales/*.ts`
- `docs/design-brief-linear-alice-shell.md`
- `docs/agent-linear-alignment.md`

## Captured Frontend Ideas

These are accepted as current product/development direction, not random parking-lot notes:

- Wire the `Ask Alice` composer into the real workspace flow. Submitting from the root surface should create or reuse a chat-template workspace, spawn an agent session, pass the typed prompt, and focus the resulting workspace/session tab.
- Make composer keyboard behavior real: Enter submits when appropriate, Shift+Enter inserts a newline, disabled/loading states prevent double submit, and errors surface inline.
- Connect `Skills` to an actual skills/tool surface instead of leaving it as visual chrome. If the skills backend is not ready, route it to the closest existing capability list rather than a dead button.
- Connect `Attach context` to a small picker for workspace, file, market symbol, tracked entity, or current page context, then include that context in the spawned session payload.
- Decide whether the shared-skills banner is a live feature or future copy. If live, wire `Dismiss` and `Share skills`; if not, remove or demote it so the root surface does not advertise dead affordances.
- Keep the direct home entry visible. Users need a one-click way back to `Ask Alice` from any page; the current Home icon and brand click should remain part of the shell.
- Continue A/B testing against the original frontend before changing navigation or workspace behavior. The A/B script is now the default dev path for this.
- Isolate the Windows test debt separately from frontend work: POSIX path assertions, Node localStorage setup, and local auth env leakage should not block UI iteration, but they should be fixed before treating full `pnpm test` as a release gate.

## Before Pushing

```powershell
pnpm install --frozen-lockfile
pnpm -C ui build
pnpm build
git diff --check
```

`pnpm test` currently has Windows-environment failures unrelated to this frontend pass: POSIX path assertions, Node localStorage setup, and local auth env leakage into agent-probe tests. Do not treat those as a frontend regression without isolating the suite first.
