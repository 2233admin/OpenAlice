#!/usr/bin/env bash
# Consumer-only workspace: no service startup, dependency install or data writes.
set -euo pipefail

TAG="${1:?tag required}"
OUT_DIR="${2:?outDir required}"
source "$(dirname "${BASH_SOURCE[0]}")/../_common.sh"

init_workspace_dir "$OUT_DIR"
copy_readme
cp -R "${AQ_TEMPLATE_FILES_DIR:?template files directory required}/." .

# Serialize JSON after substitution so spaces, quotes and Windows paths stay valid.
node --input-type=module <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs'
const root = process.env.KATANA_RUNTIME_ROOT?.replace(/\\/g, '/').replace(/\/+$/, '')
if (root) {
  const config = JSON.parse(readFileSync('.mcp.json', 'utf8'))
  config.mcpServers.katana.args = config.mcpServers.katana.args.map(
    arg => arg.replaceAll('<KATANA_RUNTIME_ROOT>', root))
  writeFileSync('.mcp.json', JSON.stringify(config, null, 2) + '\n')
} else {
  console.warn('[katana-desk] Set <KATANA_RUNTIME_ROOT> in .mcp.json before using the katana server.')
}
NODE

git init -q
setup_git_excludes
printf "bootstrapped katana-desk workspace '%s' at %s\n" "$TAG" "$OUT_DIR"
