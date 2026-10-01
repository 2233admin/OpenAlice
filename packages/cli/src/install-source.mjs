import { getProductVersion } from '@traderalice/update-lifecycle/node'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseInstallSource, requireInstallSource, installSourceUpdateChannel, releaseChannelMatchesVersion } from '@traderalice/update-lifecycle'
export { parseInstallSource, requireInstallSource, installSourceUpdateChannel } from '@traderalice/update-lifecycle'

import {
  bunInstallSourceLocations,
  isBunStandalone,
  resolveBunContentIdentity,
  resolveBunResourceRoot,
} from './bun-standalone.mjs'

export const CLI_VERSION = getProductVersion()

const sourceExecution = globalThis.__OPENALICE_BUILD_VERSION__ === undefined
const betaCliVersion = releaseChannelMatchesVersion('beta', CLI_VERSION)

export const DEFAULT_INSTALL_SOURCE = Object.freeze({
  schemaVersion: 2,
  repository: 'TraderAlice/OpenAlice',
  cliVersion: CLI_VERSION,
  selector: Object.freeze(sourceExecution ? { kind: 'branch', value: 'dev' } : betaCliVersion
    ? { kind: 'version', value: `v${CLI_VERSION}` }
    : { kind: 'branch', value: 'master' }),
  installerUrl: 'https://openalice.ai/install',
  updateChannel: sourceExecution ? 'development' : betaCliVersion ? 'beta' : 'stable',
})

export function installSourceChannelVersionError(source) {
  const normalized = requireInstallSource(source)
  const channel = installSourceUpdateChannel(normalized)
  if (channel === 'stable' && !releaseChannelMatchesVersion('stable', normalized.cliVersion)) {
    return `CLI ${normalized.cliVersion} is marked stable, but the installer requires a stable version. Refresh this client's install-source metadata before upgrading a remote Machine.`
  }
  if (channel === 'beta' && !releaseChannelMatchesVersion('beta', normalized.cliVersion)) {
    return `CLI ${normalized.cliVersion} is marked beta, but the installer requires a beta version. Refresh this client's install-source metadata before upgrading a remote Machine.`
  }
  return null
}

export async function readInstallSource(options = {}) {
  const env = options.env ?? process.env
  const metadataLocations = options.metadataUrl
    ? [options.metadataUrl]
    : env['OPENALICE_INSTALL_SOURCE']
      ? [env['OPENALICE_INSTALL_SOURCE']]
      : nativeInstallSourceLocations(options, env)
  for (const metadataUrl of metadataLocations) {
    try {
      return requireInstallSource(JSON.parse(await readFile(metadataUrl, 'utf8')))
    } catch (error) {
      if (error?.code === 'ENOENT') continue
      throw error
    }
  }
  const source = cloneInstallSource(DEFAULT_INSTALL_SOURCE)
  if (['dev', 'electron-dev', 'electron'].includes(env.OPENALICE_RUNTIME_PROFILE || env.OPENALICE_LAUNCHER)) {
    source.selector = { kind: 'branch', value: 'dev' }
    source.updateChannel = 'development'
  }
  return source
}

export function installedContentIdentity(moduleUrl = import.meta.url, options = {}) {
  const env = options.env ?? process.env
  const explicit = env['OPENALICE_CONTENT_IDENTITY']?.trim()
  if (/^[a-f0-9]{16}$/.test(explicit ?? '')) return explicit
  const bunStandalone = options.bunStandalone ?? isBunStandalone()
  if (bunStandalone) {
    return resolveBunContentIdentity(
      resolveBunResourceRoot(env, options.executable ?? process.execPath),
      env,
      options.readFileSync ?? readFileSync,
    )
  }
  const releaseDirectory = basename(dirname(dirname(fileURLToPath(moduleUrl))))
  return /-([a-f0-9]{16})$/.exec(releaseDirectory)?.[1] ?? null
}

function nativeInstallSourceLocations(options, env) {
  const bunStandalone = options.bunStandalone ?? isBunStandalone()
  if (!bunStandalone) return [new URL('../install-source.json', import.meta.url)]
  const executable = options.executable ?? process.execPath
  return bunInstallSourceLocations(
    env,
    executable,
    resolveBunResourceRoot(env, executable),
  )
}

export function normalizeInstallSource(value, fallback = DEFAULT_INSTALL_SOURCE) {
  return parseInstallSource(value) ?? cloneInstallSource(fallback)
}

export function installSourcesMatch(left, right) {
  const normalizedLeft = parseInstallSource(left)
  const normalizedRight = parseInstallSource(right)
  if (!normalizedLeft || !normalizedRight) return false
  return normalizedLeft.repository === normalizedRight.repository
    && normalizedLeft.cliVersion === normalizedRight.cliVersion
    && normalizedLeft.selector.kind === normalizedRight.selector.kind
    && normalizedLeft.selector.value === normalizedRight.selector.value
    && normalizedLeft.installerUrl === normalizedRight.installerUrl
    && installSourceUpdateChannel(normalizedLeft) === installSourceUpdateChannel(normalizedRight)
}

export function formatInstallSelector(source) {
  const normalized = normalizeInstallSource(source)
  return `${normalized.selector.kind} ${normalized.selector.value}`
}

export function managedSourceKey(source) {
  const normalized = requireInstallSource(source)
  const readable = `${normalized.selector.kind}-${normalized.selector.value}`
    .replaceAll(/[^A-Za-z0-9._-]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .slice(0, 48) || 'source'
  const digest = createHash('sha256')
    .update(`${normalized.selector.kind}:${normalized.selector.value}`)
    .digest('hex')
    .slice(0, 8)
  return `${readable}-${digest}`
}

function cloneInstallSource(source) {
  return {
    schemaVersion: source.schemaVersion,
    repository: source.repository,
    cliVersion: source.cliVersion,
    selector: { ...source.selector },
    installerUrl: source.installerUrl,
    ...(source.schemaVersion >= 2 ? { updateChannel: source.updateChannel } : {}),
    ...(source.schemaVersion === 3 && source.method ? { method: source.method } : {}),
    ...(source.schemaVersion === 3 && source.artifact ? { artifact: { ...source.artifact } } : {}),
    ...(source.schemaVersion === 3 && source.installedAt ? { installedAt: source.installedAt } : {}),
  }
}
