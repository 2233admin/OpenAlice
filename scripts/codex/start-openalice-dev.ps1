param(
  [int]$UiPort = 5173,
  [int]$WebPort = 47333,
  [int]$McpPort = 47334,
  [int]$UtaPort = 47335
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$logDir = Join-Path $root "logs"
$dataHome = Join-Path $root ".openalice-dev"
$logFile = Join-Path $logDir "openalice-dev.log"

New-Item -ItemType Directory -Force -Path $logDir, $dataHome | Out-Null

Set-Location $root
$env:OPENALICE_HOME = $dataHome
$env:OPENALICE_UI_PORT = [string]$UiPort
$env:OPENALICE_WEB_PORT = [string]$WebPort
$env:OPENALICE_MCP_PORT = [string]$McpPort
$env:OPENALICE_UTA_PORT = [string]$UtaPort
if (-not $env:CCXT_HTTPS_PROXY) {
  $env:CCXT_HTTPS_PROXY = "http://127.0.0.1:7897"
}

Write-Host "OpenAlice UI:      http://localhost:$UiPort"
Write-Host "OpenAlice backend: http://127.0.0.1:$WebPort"
Write-Host "OpenAlice UTA:     http://127.0.0.1:$UtaPort/__uta/health"
Write-Host "CCXT HTTPS proxy:  $env:CCXT_HTTPS_PROXY"
Write-Host "Log file:          $logFile"

pnpm dev *>&1 | Tee-Object -FilePath $logFile
