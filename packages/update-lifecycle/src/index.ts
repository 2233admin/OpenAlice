/** Pure update policy shared by runtime discovery, CLI and the rehearsal.
 * Transport, trust validation, installation and approval remain owner concerns. */
export type ReleaseChannel = 'stable' | 'beta' | 'dev'
export interface ReleaseIdentity {
  channel: ReleaseChannel
  version: string
  commit?: string
  /** Same platform's immutable payload hash, when the owner can report it. */
  artifactSha256?: string
}
export interface InstalledRelease extends Omit<ReleaseIdentity, 'channel'> {
  channel: ReleaseChannel | 'pinned' | 'custom' | null
}
export type ReleaseDecision = {
  status: 'available' | 'current' | 'blocked' | 'unknown'
  reason: 'newer-release' | 'different-dev-build' | 'channel-change' | 'same-release'
    | 'older-release' | 'missing-candidate' | 'invalid-identity' | 'wrong-channel'
}

interface ParsedVersion { core: string[]; prerelease: string[] }
function parseVersion(value: string): ParsedVersion | null {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(value)
  if (!match) return null
  const prerelease = match[4]?.split('.') ?? []
  if (prerelease.some(part => /^\d+$/.test(part) && part.length > 1 && part[0] === '0')) return null
  return { core: match.slice(1, 4), prerelease }
}
export function isVersion(value: string): boolean { return parseVersion(value) !== null }

function compareNumeric(left: string, right: string): number {
  return left.length === right.length ? (left === right ? 0 : left > right ? 1 : -1)
    : left.length > right.length ? 1 : -1
}
/** SemVer precedence, independent of locale, build metadata and installer provenance.
 * Malformed input is not version zero: discovery must surface missing evidence. */
export function compareVersions(left: string, right: string): number {
  const a = parseVersion(left), b = parseVersion(right)
  if (!a || !b) throw new Error(`Invalid OpenAlice version: ${!a ? left : right}`)
  for (let i = 0; i < 3; i++) {
    const result = compareNumeric(a.core[i], b.core[i])
    if (result) return result
  }
  if (!a.prerelease.length || !b.prerelease.length)
    return a.prerelease.length === b.prerelease.length ? 0 : a.prerelease.length ? -1 : 1
  for (let i = 0; i < Math.max(a.prerelease.length, b.prerelease.length); i++) {
    const x = a.prerelease[i], y = b.prerelease[i]
    if (x === y) continue
    if (x === undefined) return -1
    if (y === undefined) return 1
    const xn = /^\d+$/.test(x), yn = /^\d+$/.test(y)
    if (xn && yn) return compareNumeric(x, y)
    if (xn !== yn) return xn ? -1 : 1
    return x > y ? 1 : -1
  }
  return 0
}
export function newerRelease(latest: string | null | undefined, current: string): boolean {
  return Boolean(latest && isVersion(latest) && isVersion(current) && compareVersions(latest, current) > 0)
}
/** Product feed validation is narrower than general Workspace SemVer parsing. */
export function releaseChannelMatchesVersion(channel: ReleaseChannel, version: string): boolean {
  if (!isVersion(version)) return false
  if (channel === 'dev') return true
  if (channel === 'stable') return /^\d+\.\d+\.\d+$/.test(version)
  return /^\d+\.\d+\.\d+-beta(?:\.[1-9][0-9]*)?$/.test(version)
}
export function identityLabel(release: ReleaseIdentity): string {
  return release.channel === 'dev' ? `${release.version}+dev.${release.commit ?? 'unknown'}` : release.version
}

/** Candidate must be the accepted head of the requested feed, after owner trust
 * validation. SHAs have identity, not temporal order. A channel switch is an
 * explicit intent; normal checks never advertise a SemVer downgrade as an update.
 * This decision does NOT grant installation approval or prove client compatibility. */
export function selectRelease(
  current: InstalledRelease,
  candidate: ReleaseIdentity | null,
  channel: ReleaseChannel,
  intent: 'update' | 'switch-channel' = 'update',
): ReleaseDecision {
  if (!candidate) return { status: 'unknown', reason: 'missing-candidate' }
  if (candidate.channel !== channel) return { status: 'blocked', reason: 'wrong-channel' }
  if (!isVersion(current.version) || !releaseChannelMatchesVersion(channel, candidate.version))
    return { status: 'unknown', reason: 'invalid-identity' }
  if (channel === 'dev') {
    if (!candidate.commit || !/^[a-f0-9]{7,64}$/.test(candidate.commit))
      return { status: 'unknown', reason: 'invalid-identity' }
    // Owners with artifact receipts compare exact payloads. Equal commits can
    // still carry a rebuilt payload; a commit alone cannot disprove that evidence.
    const same = current.artifactSha256 && candidate.artifactSha256
      ? current.artifactSha256 === candidate.artifactSha256
      : Boolean(current.commit && current.commit === candidate.commit)
    return current.channel === 'dev' && same
      ? { status: 'current', reason: 'same-release' }
      : { status: 'available', reason: 'different-dev-build' }
  }
  if (intent === 'switch-channel' && current.channel !== channel)
    return { status: 'available', reason: 'channel-change' }
  const precedence = compareVersions(candidate.version, current.version)
  return precedence > 0 ? { status: 'available', reason: 'newer-release' }
    : precedence === 0 ? { status: 'current', reason: 'same-release' }
      : { status: 'blocked', reason: 'older-release' }
}
