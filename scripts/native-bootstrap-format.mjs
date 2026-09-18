import { closeSync, openSync, readSync } from 'node:fs'

const HEADER_BYTES = 4096

export function verifyNativeBootstrapFormat(executablePath, platform, arch) {
  const header = Buffer.allocUnsafe(HEADER_BYTES)
  const descriptor = openSync(executablePath, 'r')
  let bytesRead
  try {
    bytesRead = readSync(descriptor, header, 0, header.length, 0)
  } finally {
    closeSync(descriptor)
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
  } else if (platform === 'darwin') {
    if (bytes.length < 8 || bytes.readUInt32LE(0) !== 0xfeedfacf) throw new Error('native bootstrap is not a 64-bit Mach-O executable')
    actualMachine = bytes.readUInt32LE(4)
    expectedMachine = arch === 'x64' ? 0x01000007 : 0x0100000c
  } else {
    throw new Error(`unsupported native bootstrap platform: ${platform}`)
  }
  if (!['x64', 'arm64'].includes(arch) || actualMachine !== expectedMachine) {
    throw new Error(`native bootstrap architecture mismatch: expected ${platform}-${arch}`)
  }
  return 'passed'
}
