import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, open, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

interface NativeBootstrapBuildOptions {
  repositoryRoot: string
  outputRoot: string
  version: string
  platform: 'darwin' | 'linux' | 'win32'
  arch: 'arm64' | 'x64'
  target?: 'bun-darwin-arm64' | 'bun-darwin-x64' | 'bun-linux-arm64' | 'bun-linux-x64' | 'bun-windows-arm64' | 'bun-windows-x64'
}

export async function buildNativeBootstrap(options: NativeBootstrapBuildOptions): Promise<{
  executablePath: string
  sha256Path: string
  sha256: string
  formatVerification: 'passed'
  runtimeVerification: 'passed' | 'not-run-cross-target'
}> {
  const name = `openalice-bootstrap-${options.version}-${options.platform}-${options.arch}${options.platform === 'win32' ? '.exe' : ''}`
  const executablePath = join(options.outputRoot, name)
  await mkdir(options.outputRoot, { recursive: true })
  await rm(executablePath, { force: true })
  await rm(`${executablePath}.sha256`, { force: true })
  const result = await Bun.build({
    entrypoints: [join(options.repositoryRoot, 'packages/cli/bin/openalice-bootstrap.ts')],
    compile: {
      outfile: executablePath,
      ...(options.target ? { target: options.target } : {}),
      autoloadBunfig: false,
      autoloadDotenv: false,
    },
    define: {
      'globalThis.__OPENALICE_BUILD_VERSION__': JSON.stringify(options.version),
      'globalThis.__OPENALICE_BUN_STANDALONE__': 'true',
    },
    minify: true,
  })
  if (!result.success) throw new Error(result.logs.map(String).join('\n'))
  const formatVerification = await verifyExecutableFormat(executablePath, options.platform, options.arch)
  const sha256 = await sha256File(executablePath)
  const sha256Path = `${executablePath}.sha256`
  await writeFile(sha256Path, `${sha256}  ${basename(executablePath)}\n`)
  const runtimeVerification = process.platform === options.platform && process.arch === options.arch
    ? smokeNativeBootstrap(executablePath)
    : 'not-run-cross-target'
  return { executablePath, sha256Path, sha256, formatVerification, runtimeVerification }
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

function smokeNativeBootstrap(executablePath: string): 'passed' {
  const smoke = Bun.spawnSync([executablePath, '--help'], { stdout: 'pipe', stderr: 'pipe' })
  if (smoke.exitCode !== 0 || !smoke.stdout.toString().includes('OpenAlice Native Bootstrap')) {
    throw new Error(`native bootstrap smoke failed: ${smoke.stderr.toString()}`)
  }
  return 'passed'
}

async function verifyExecutableFormat(
  executablePath: string,
  platform: NativeBootstrapBuildOptions['platform'],
  arch: NativeBootstrapBuildOptions['arch'],
): Promise<'passed'> {
  const header = Buffer.allocUnsafe(4096)
  const handle = await open(executablePath, 'r')
  let bytesRead
  try {
    ({ bytesRead } = await handle.read(header, 0, header.length, 0))
  } finally {
    await handle.close()
  }
  const bytes = header.subarray(0, bytesRead)
  let actualMachine
  let expectedMachine
  if (platform === 'win32') {
    if (bytes.length < 64 || bytes.toString('ascii', 0, 2) !== 'MZ') throw new Error('native bootstrap is not a PE executable')
    const peOffset = bytes.readUInt32LE(0x3c)
    if (peOffset + 6 > bytes.length || bytes.toString('ascii', peOffset, peOffset + 4) !== 'PE\0\0') {
      throw new Error('native bootstrap has an invalid PE header')
    }
    actualMachine = bytes.readUInt16LE(peOffset + 4)
    expectedMachine = arch === 'x64' ? 0x8664 : 0xaa64
  } else if (platform === 'linux') {
    if (bytes.length < 20 || !bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) || bytes[4] !== 2 || bytes[5] !== 1) {
      throw new Error('native bootstrap is not a 64-bit little-endian ELF executable')
    }
    actualMachine = bytes.readUInt16LE(18)
    expectedMachine = arch === 'x64' ? 0x3e : 0xb7
  } else {
    if (bytes.length < 8 || bytes.readUInt32LE(0) !== 0xfeedfacf) throw new Error('native bootstrap is not a 64-bit Mach-O executable')
    actualMachine = bytes.readUInt32LE(4)
    expectedMachine = arch === 'x64' ? 0x01000007 : 0x0100000c
  }
  if (actualMachine !== expectedMachine) {
    throw new Error(`native bootstrap architecture mismatch: expected ${platform}-${arch}`)
  }
  return 'passed'
}
