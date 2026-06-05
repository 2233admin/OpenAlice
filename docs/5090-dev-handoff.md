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

The script starts B first and waits for its UI before starting A. This is intentional: a clean upstream A checkout does not know the new fixed-port environment variables yet, so it auto-selects the next free backend and Vite ports after B has occupied the defaults. For A backend and UTA ports, read `.dev/openalice-original.out.log`.

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

## Before Pushing

```powershell
pnpm install --frozen-lockfile
pnpm -C ui build
pnpm build
git diff --check
```

`pnpm test` currently has Windows-environment failures unrelated to this frontend pass: POSIX path assertions, Node localStorage setup, and local auth env leakage into agent-probe tests. Do not treat those as a frontend regression without isolating the suite first.
