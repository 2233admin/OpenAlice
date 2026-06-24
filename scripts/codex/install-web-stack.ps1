param(
  [switch]$Clean
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $root

if ($Clean -and (Test-Path ".\node_modules")) {
  Remove-Item -LiteralPath ".\node_modules" -Recurse -Force
}

Get-ChildItem $env:TEMP -Directory -Filter "dugite-native-*" -ErrorAction SilentlyContinue |
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

# Electron and dugite postinstall download bundled binaries. They are not
# required for the local Web UI + UTA service workflow and can hang on Windows.
pnpm install --ignore-scripts --config.side-effects-cache=false

# Workspace bootstrap needs dugite's bundled Git. Rebuild only this dependency
# so the web stack install stays lean while workspace creation fails early if
# the platform Git archive cannot be fetched.
pnpm rebuild dugite

$dugiteCheck = @'
const { existsSync } = require('fs')
const { dirname, join } = require('path')

const root = dirname(require.resolve('dugite/package.json'))
const git = process.platform === 'win32'
  ? join(root, 'git', 'cmd', 'git.exe')
  : join(root, 'git', 'bin', 'git')

if (!existsSync(git)) {
  console.error(`dugite embedded git MISSING at ${git}`)
  process.exit(1)
}

console.log(`dugite embedded git OK ${git}`)
'@
node -e $dugiteCheck

pnpm -F "@traderalice/uta-service" build
pnpm -F "open-alice-ui" build
