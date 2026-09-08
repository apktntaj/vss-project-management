import assert from 'node:assert/strict'
import { UserSchema } from './validation'

const admin = UserSchema.parse({
  nama: 'Admin Demo VSS',
  email: ' ADMIN@VSS.DEMO ',
  password: 'demo-vss-2026',
  isAdmin: true,
})

assert.equal(admin.email, 'admin@vss.demo')
assert.equal(admin.isAdmin, true)
assert.equal(UserSchema.safeParse({ ...admin, nama: '' }).success, false)
assert.equal(UserSchema.safeParse({ ...admin, email: 'bukan-email' }).success, false)
assert.equal(UserSchema.safeParse({ ...admin, password: '' }).success, false)

console.log('user domain validation passed')
