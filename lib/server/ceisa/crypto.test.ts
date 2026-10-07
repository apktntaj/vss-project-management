import assert from 'node:assert/strict'
import { test } from 'bun:test'
import { decryptCeisaValue, encryptCeisaValue } from './crypto'

const key = Buffer.alloc(32, 7).toString('base64')
test('CEISA credentials encrypt with distinct IVs and decrypt only with the configured key', () => {
  const prior = process.env.CEISA_CREDENTIAL_ENCRYPTION_KEY
  process.env.CEISA_CREDENTIAL_ENCRYPTION_KEY = key
  try {
    const first = encryptCeisaValue({ username: 'operator', password: 'secret', apiKey: 'key' })
    const second = encryptCeisaValue({ username: 'operator', password: 'secret', apiKey: 'key' })
    assert.notEqual(first.ciphertext, second.ciphertext)
    assert.notEqual(first.iv, second.iv)
    assert.deepEqual(decryptCeisaValue<{ username: string; password: string; apiKey: string }>(first), { username: 'operator', password: 'secret', apiKey: 'key' })
  } finally {
    if (prior === undefined) delete process.env.CEISA_CREDENTIAL_ENCRYPTION_KEY
    else process.env.CEISA_CREDENTIAL_ENCRYPTION_KEY = prior
  }
})
