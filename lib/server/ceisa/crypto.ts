import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export type EncryptedValue = { ciphertext: string; iv: string; tag: string }

function key() {
  const encoded = process.env.CEISA_CREDENTIAL_ENCRYPTION_KEY
  if (!encoded) throw new Error('CEISA credential encryption is unavailable.')
  const value = Buffer.from(encoded, 'base64')
  if (value.length !== 32) throw new Error('CEISA credential encryption is unavailable.')
  return value
}

export function encryptCeisaValue(value: unknown): EncryptedValue {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return { ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') }
}

export function decryptCeisaValue<T>(value: EncryptedValue): T {
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(value.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(value.tag, 'base64'))
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.ciphertext, 'base64')), decipher.final()]).toString('utf8')) as T
  } catch {
    throw new Error('CEISA credential encryption is unavailable.')
  }
}
