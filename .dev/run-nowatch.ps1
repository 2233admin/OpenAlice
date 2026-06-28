# OpenAlice — Windows dev launcher WITHOUT tsx watch.
# Workaround: `pnpm dev` (guardian) uses `tsx watch src/main.ts`; the recursive
# file-watcher init on the large src/ tree hangs on this Windows box, so Alice
# never boots. This launches UTA -> Alice -> Vite directly (no watch), detached.
$ErrorActionPreference = 'Stop'
$root = 'D:\projects\openalice'
$tsx  = "$root\node_modules\tsx\dist\cli.mjs"
$dataHome = "$env:USERPROFILE\.openalice"
$dev  = "$root\.dev"
$pnpm = "$env:APPDATA\npm\pnpm.cmd"
Set-Location $root

function Wait-Http($url, $timeoutSec) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    try { $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3; if ($r.StatusCode -ge 200) { return $true } } catch {}
    Start-Sleep -Milliseconds 700
  }
  return $false
}
function Wait-Port($port, $timeoutSec) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1', $port); $c.Close(); return $true } catch {}
    Start-Sleep -Milliseconds 600
  }
  return $false
}

# --- UTA (trading adapter) ---
$env:OPENALICE_HOME      = $dataHome
$env:NODE_OPTIONS        = '--conditions=openalice-source'
$env:OPENALICE_UTA_PORT  = '47333'
$uta = Start-Process node -ArgumentList "`"$tsx`"","services/uta/src/main.ts" `
  -RedirectStandardOutput "$dev\uta.out.log" -RedirectStandardError "$dev\uta.err.log" -WindowStyle Hidden -PassThru
"UTA   pid=$($uta.Id) — waiting for /__uta/health ..."
if (-not (Wait-Http 'http://127.0.0.1:47333/__uta/health' 45)) { "UTA health FAILED — see .dev\uta.*.log"; exit 1 }
"UTA   ready (47333)"

# --- Alice (backend / web / mcp) ---
$env:OPENALICE_WEB_PORT  = '47331'
$env:OPENALICE_MCP_PORT  = '47332'
$env:OPENALICE_UI_PORT   = '5173'
$env:OPENALICE_UTA_URL   = 'http://127.0.0.1:47333'
$alice = Start-Process node -ArgumentList "`"$tsx`"","src/main.ts" `
  -RedirectStandardOutput "$dev\alice.out.log" -RedirectStandardError "$dev\alice.err.log" -WindowStyle Hidden -PassThru
"Alice pid=$($alice.Id) — booting ..."

# --- Vite (UI dev server) ---
$env:OPENALICE_BACKEND_PORT = '47331'
$env:OPENALICE_UI_PORT      = '5173'
$vite = Start-Process $pnpm -ArgumentList '--filter','open-alice-ui','dev' `
  -RedirectStandardOutput "$dev\vite.out.log" -RedirectStandardError "$dev\vite.err.log" -WindowStyle Hidden -PassThru
"Vite  pid=$($vite.Id) — booting ..."

"$($uta.Id) $($alice.Id) $($vite.Id)" | Set-Content "$dev\nowatch.pids"

$aliceUp = Wait-Port 47331 75
$viteUp  = Wait-Port 5173 75
""
"==== STATUS ===="
"UTA   47333 : $(if (Wait-Port 47333 1) {'UP'} else {'DOWN'})"
"Alice 47331 : $(if ($aliceUp) {'UP'} else {'DOWN'})"
"MCP   47332 : $(if (Wait-Port 47332 1) {'UP'} else {'DOWN'})"
"Vite  5173  : $(if ($viteUp) {'UP'} else {'DOWN'})"
"pids saved to .dev\nowatch.pids ($($uta.Id) $($alice.Id) $($vite.Id))"
