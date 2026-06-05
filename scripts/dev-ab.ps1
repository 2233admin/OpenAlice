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
    Start-Stack -Name $OriginalName -Repo $OriginalRepo -WebStart 47431 -UtaStart 47433 -UiStart 5174 -ExactPorts $false
    Wait-Http 'http://localhost:5174'
    Write-Host ''
    Write-Host 'B modified: http://127.0.0.1:5173'
    Write-Host 'A original:  http://localhost:5174'
  }
  'stop' {
    Stop-Stack -Name $OriginalName
    Stop-Stack -Name $ModifiedName
  }
  'status' {
    Show-Status
  }
}
