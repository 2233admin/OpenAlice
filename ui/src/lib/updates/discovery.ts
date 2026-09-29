export function newerRelease(
  latest: string | null | undefined,
  current: string,
): boolean {
  const parse = (version: string) =>
    /^v?(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/.exec(version)
  const a = latest && parse(latest)
  const b = parse(current)
  if (!a || !b) return false
  for (let index = 1; index <= 3; index += 1) {
    const difference = Number(a[index]) - Number(b[index])
    if (difference) return difference > 0
  }
  if (!a[4]) return Boolean(b[4])
  if (!b[4]) return false
  return a[4].localeCompare(b[4], undefined, { numeric: true }) > 0
}

export type ReleaseChannel = 'stable' | 'beta' | 'dev'
export interface ReleaseIdentity {
  channel: ReleaseChannel
  version: string
  commit?: string
}
export function identityLabel(release: ReleaseIdentity): string {
  return release.channel === 'dev'
    ? `${release.version}+dev.${release.commit}`
    : release.version
}
/** Commit feeds identify immutable builds, not an ordering of SHA strings.
 * The caller supplies the accepted channel head, never an arbitrary candidate. */
export function isReleaseUpdate(
  current: ReleaseIdentity,
  latest: ReleaseIdentity | null,
  channel: ReleaseChannel,
): boolean {
  if (!latest || latest.channel !== channel) return false
  if (channel === 'dev')
    return Boolean(
      latest.commit &&
        (current.channel !== 'dev' || current.commit !== latest.commit),
    )
  return newerRelease(latest.version, current.version)
}
