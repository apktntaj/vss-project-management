import 'server-only'
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
const keyLength = 64
const cost = 16_384
const blockSize = 8
const parallelization = 1

function derive(password: string, salt: Buffer, length: number, options: { N: number; r: number; p: number; maxmem: number }) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, length, options, (error, key) => error ? reject(error) : resolve(key))
  })
}

/** Password hashes are stored as a self-describing, versioned scrypt value. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await derive(password, salt, keyLength, { N: cost, r: blockSize, p: parallelization, maxmem: 32 * 1024 * 1024 })
  return ['scrypt', cost, blockSize, parallelization, salt.toString('base64url'), hash.toString('base64url')].join('$')
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, encodedCost, encodedBlockSize, encodedParallelization, salt, expected] = encoded.split('$')
  if (algorithm !== 'scrypt' || !encodedCost || !encodedBlockSize || !encodedParallelization || !salt || !expected) return false
  try {
    const expectedHash = Buffer.from(expected, 'base64url')
    const actualHash = await derive(password, Buffer.from(salt, 'base64url'), expectedHash.length, {
      N: Number(encodedCost), r: Number(encodedBlockSize), p: Number(encodedParallelization), maxmem: 32 * 1024 * 1024,
    })
    return actualHash.length === expectedHash.length && timingSafeEqual(actualHash, expectedHash)
  } catch {
    return false
  }
}
