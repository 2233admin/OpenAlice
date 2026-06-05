param(
  [ValidateSet('start', 'stop', 'status')]
  [string]$Action = 'start',

  [string]$ModifiedRepo = (Join-Path $PSScriptRoot '..'),
  [string]$OriginalRepo = (Join-Path $PSScriptRoot '..\..\OpenAlice-latest')
)

$ErrorActionPreference = 'Stop'

$RunDir = Join-Path $ModifiedRepo '.dev'
$ModifiedName = 'openalice-modified'
$OriginalName = 'openalice-original'

function New-RunDir {
  New-Item -ItemType Directory -Force -Path $RunDir | Out-Null
}

function Get-PidPath([string]$Name) {
  Join-Path $RunDir "$Name.pid"
}

function Get-LogPath([string]$Name, [string]$Stream) {
  Join-Path $RunDir "$Name.$Stream.log"
}

function Format-PsLiteral([string]$Value) {
  "'$($Value -replace "'", "''")'"
}

function Test-Running([string]$Name) {
  $pidPath = Get-PidPath $Name
  if (-not (Test-Path -LiteralPath $pidPath)) { return $false }
  $processId = [int](Get-Content -LiteralPath $pidPath -Raw)
  return [bool](Get-Process -Id $processId -ErrorAction SilentlyContinue)
}

function Start-Stack(
  [string]$Name,
  [string]$Repo,
  [int]$WebStart,
  [int]$UtaStart,
  [int]$UiStart,
  [bool]$ExactPorts = $true
) {
  $resolvedRepo = (Resolve-Path -LiteralPath $Repo).Path

  if (Test-Running $Name) {
    Write-Host "$Name already running (pid $(Get-Content -LiteralPath (Get-PidPath $Name) -Raw))"
    return
  }

  $out = Get-LogPath $Name 'out'
  $err = Get-LogPath $Name 'err'
  Remove-Item -LiteralPath $out, $err -ErrorAction SilentlyContinue

  $command = @"
`$env:OPENALICE_WEB_PORT_START='$WebStart'
`$env:OPENALICE_UTA_PORT_START='$UtaStart'
`$env:OPENALICE_UI_PORT_START='$UiStart'
pnpm dev
"@

  $process = Start-Process `
    -FilePath 'powershell.exe' `
    -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $command) `
    -WorkingDirectory $resolvedRepo `
    -WindowStyle Hidden `
    -RedirectStandardOutput $out `
    -RedirectStandardError $err `
    -PassThru

  Set-Content -LiteralPath (Get-PidPath $Name) -Value $process.Id
  if ($ExactPorts) {
    Write-Host "$Name pid=$($process.Id) ui=http://127.0.0.1:$UiStart backend=$WebStart uta=$UtaStart"
  } else {
    Write-Host "$Name pid=$($process.Id) ui should land on http://127.0.0.1:$UiStart; see .dev/$Name.out.log for backend/UTA ports"
  }
}

function Start-OriginalStack(
  [string]$Name,
  [string]$Repo,
  [int]$WebPort,
  [int]$McpPort,
  [int]$UtaPort,
  [int]$UiPort
) {
  $resolvedRepo = (Resolve-Path -LiteralPath $Repo).Path

  if (Test-Running $Name) {
    Write-Host "$Name already running (pid $(Get-Content -LiteralPath (Get-PidPath $Name) -Raw))"
    return
  }

  $out = Get-LogPath $Name 'out'
  $err = Get-LogPath $Name 'err'
  $utaOut = Get-LogPath $Name 'uta.out'
  $utaErr = Get-LogPath $Name 'uta.err'
  $aliceOut = Get-LogPath $Name 'alice.out'
  $aliceErr = Get-LogPath $Name 'alice.err'
  $viteOut = Get-LogPath $Name 'vite.out'
  $viteErr = Get-LogPath $Name 'vite.err'
  Remove-Item -LiteralPath $out, $err, $utaOut, $utaErr, $aliceOut, $aliceErr, $viteOut, $viteErr -ErrorAction SilentlyContinue

  $repoLiteral = Format-PsLiteral $resolvedRepo
  $utaOutLiteral = Format-PsLiteral $utaOut
  $utaErrLiteral = Format-PsLiteral $utaErr
  $aliceOutLiteral = Format-PsLiteral $aliceOut
  $aliceErrLiteral = Format-PsLiteral $aliceErr
  $viteOutLiteral = Format-PsLiteral $viteOut
  $viteErrLiteral = Format-PsLiteral $viteErr

  $command = @"
`$ErrorActionPreference = 'Stop'

function Wait-Http([string]`$Url, [int]`$TimeoutSeconds = 90) {
  `$deadline = (Get-Date).AddSeconds(`$TimeoutSeconds)
  while ((Get-Date) -lt `$deadline) {
    try {
      Invoke-WebRequest -Uri `$Url -UseBasicParsing -TimeoutSec 2 | Out-Null
      return
    } catch {
      Start-Sleep -Milliseconds 750
    }
  }
  throw "Timed out waiting for `$Url"
}

function Stop-ChildTree(`$Process) {
  if (`$null -eq `$Process) { return }
  try { `$Process.Refresh() } catch { return }
  if (`$Process.HasExited) { return }
  if (`$env:OS -eq 'Windows_NT') {
    taskkill /PID `$Process.Id /T /F | Out-Null
  } else {
    Stop-Process -Id `$Process.Id -Force
  }
}

`$pnpm = (Get-Command pnpm.cmd -ErrorAction SilentlyContinue).Source
if (-not `$pnpm) { `$pnpm = (Get-Command pnpm -ErrorAction Stop).Source }

`$env:NODE_OPTIONS = (([string]`$env:NODE_OPTIONS + ' --conditions=openalice-source').Trim())
`$env:OPENALICE_USER_DATA_HOME = $repoLiteral

Write-Host "[dev-ab] original UTA    http://127.0.0.1:$UtaPort"
Write-Host "[dev-ab] original Alice  http://127.0.0.1:$WebPort"
Write-Host "[dev-ab] original MCP    http://127.0.0.1:$McpPort/mcp"
Write-Host "[dev-ab] original UI     http://127.0.0.1:$UiPort"

`$uta = `$null
`$alice = `$null
`$vite = `$null
try {
  `$env:OPENALICE_UTA_PORT = '$UtaPort'
  `$uta = Start-Process -FilePath `$pnpm -ArgumentList @('exec','tsx','watch','services/uta/src/main.ts') -WorkingDirectory $repoLiteral -WindowStyle Hidden -RedirectStandardOutput $utaOutLiteral -RedirectStandardError $utaErrLiteral -PassThru
  Wait-Http 'http://127.0.0.1:$UtaPort/__uta/health'

  `$env:OPENALICE_WEB_PORT = '$WebPort'
  `$env:OPENALICE_MCP_PORT = '$McpPort'
  `$env:OPENALICE_UTA_URL = 'http://127.0.0.1:$UtaPort'
  `$alice = Start-Process -FilePath `$pnpm -ArgumentList @('exec','tsx','watch','src/main.ts') -WorkingDirectory $repoLiteral -WindowStyle Hidden -RedirectStandardOutput $aliceOutLiteral -RedirectStandardError $aliceErrLiteral -PassThru

  `$env:OPENALICE_BACKEND_PORT = '$WebPort'
  `$vite = Start-Process -FilePath `$pnpm -ArgumentList @('--filter','open-alice-ui','dev','--host','127.0.0.1','--port','$UiPort','--strictPort') -WorkingDirectory $repoLiteral -WindowStyle Hidden -RedirectStandardOutput $viteOutLiteral -RedirectStandardError $viteErrLiteral -PassThru

  while (`$true) {
    Start-Sleep -Seconds 2
    foreach (`$child in @(`$uta, `$alice, `$vite)) {
      if (`$child -and `$child.HasExited) {
        throw "child process exited: `$(`$child.Id)"
      }
    }
  }
} finally {
  Stop-ChildTree `$vite
  Stop-ChildTree `$alice
  Stop-ChildTree `$uta
}
"@

  $process = Start-Process `
    -FilePath 'powershell.exe' `
    -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $command) `
    -WorkingDirectory $resolvedRepo `
    -WindowStyle Hidden `
    -RedirectStandardOutput $out `
    -RedirectStandardError $err `
    -PassThru

  Set-Content -LiteralPath (Get-PidPath $Name) -Value $process.Id
  Write-Host "$Name pid=$($process.Id) ui=http://127.0.0.1:$UiPort backend=$WebPort uta=$UtaPort"
}

function Wait-Http([string]$Url, [int]$TimeoutSeconds = 90) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 | Out-Null
      return
    } catch {
      Start-Sleep -Milliseconds 750
    }
  }
  throw "Timed out waiting for $Url"
}

function Stop-Stack([string]$Name) {
  $pidPath = Get-PidPath $Name
  if (-not (Test-Path -LiteralPath $pidPath)) {
    Write-Host "$Name not running"
    return
  }

  $processId = [int](Get-Content -LiteralPath $pidPath -Raw)
  if (Get-Process -Id $processId -ErrorAction SilentlyContinue) {
    if ($env:OS -eq 'Windows_NT') {
      taskkill /PID $processId /T /F | Out-Host
    } else {
      Stop-Process -Id $processId -Force
    }
  }
  Remove-Item -LiteralPath $pidPath -ErrorAction SilentlyContinue
  Write-Host "$Name stopped"
}

function Show-Status {
  foreach ($name in @($ModifiedName, $OriginalName)) {
    $state = if (Test-Running $name) { 'running' } else { 'stopped' }
    Write-Host "$name $state"
    $out = Get-LogPath $name 'out'
    if (Test-Path -LiteralPath $out) {
      Get-Content -LiteralPath $out -Tail 8
    }
  }
}

New-RunDir

switch ($Action) {
  'start' {
    Start-Stack -Name $ModifiedName -Repo $ModifiedRepo -WebStart 47331 -UtaStart 47333 -UiStart 5173 -ExactPorts $true
    Wait-Http 'http://127.0.0.1:5173'
    Start-OriginalStack -Name $OriginalName -Repo $OriginalRepo -WebPort 47431 -McpPort 47432 -UtaPort 47433 -UiPort 5174
    Wait-Http 'http://127.0.0.1:5174'
    Write-Host ''
    Write-Host 'B modified: http://127.0.0.1:5173'
    Write-Host 'A original:  http://127.0.0.1:5174'
  }
  'stop' {
    Stop-Stack -Name $OriginalName
    Stop-Stack -Name $ModifiedName
  }
  'status' {
    Show-Status
  }
}
