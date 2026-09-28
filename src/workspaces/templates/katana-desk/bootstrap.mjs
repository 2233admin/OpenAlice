/**
 * Bootstrap a katana-desk workspace: a bare git repo seeded with the static
 * `files/` tree (`.mcp.json`, `.claude/skills/katana-desk`,
 * `.agents/skills/katana-desk`), nothing else.
 *
 * This is a read-only research desk: the katana kernel stays a separate,
 * closed process reached only through the stdio MCP server declared in
 * `.mcp.json`. No broker credentials, no book/lake writes, no receipt-issue
 * handling live here — see the template README (R9): receipt issues belong
 * in a dedicated agent-free desk workspace, never this one.
 *
 *   argv:  process.argv[2] = tag, process.argv[3] = outDir
 *   env:   AQ_TEMPLATE_ROOT      — abs path to this template's root (for README)
 *          AQ_TEMPLATE_FILES_DIR — abs path to this template's `files/` dir
 */

import { cpSync, existsSync } from 'node:fs'
import { initWorkspaceDir, copyReadme, setupGitExcludes, git } from '../_common.mjs'

const tag = process.argv[2]
const outDir = process.argv[3]
if (!tag || !outDir) {
  console.error('usage: bootstrap.mjs <tag> <outDir>')
  process.exit(1)
}

initWorkspaceDir(outDir)
copyReadme(outDir)

const filesDir = process.env.AQ_TEMPLATE_FILES_DIR
if (filesDir && existsSync(filesDir)) {
  cpSync(filesDir, outDir, { recursive: true })
} else {
  console.error(`[katana-desk] no files/ dir at ${filesDir ?? '(unset AQ_TEMPLATE_FILES_DIR)'}, skipping seed`)
}

await git(['init', '-q'], outDir)
setupGitExcludes(outDir)

console.log(`bootstrapped katana-desk workspace '${tag}' at ${outDir}`)
console.log('[katana-desk] edit .mcp.json: replace <KATANA_RUNTIME_ROOT> with your katana-runtime checkout path (see README.md)')
