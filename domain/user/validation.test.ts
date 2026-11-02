import assert from 'node:assert/strict'
import { UserSchema } from './validation'

const admin = UserSchema.parse({
  nama: 'Admin Demo VSS',
  email: ' ADMIN@VSS.DEMO ',
  password: 'demo-vss-2026',
  isAdmin: true,
  role: 'CS',
})

assert.equal(admin.email, 'admin@vss.demo')
assert.equal(admin.isAdmin, true)
assert.equal(admin.role, 'CS')
assert.equal(UserSchema.safeParse({ ...admin, nama: '' }).success, false)
assert.equal(UserSchema.safeParse({ ...admin, email: 'bukan-email' }).success, false)
assert.equal(UserSchema.safeParse({ ...admin, password: '' }).success, false)
assert.equal(UserSchema.safeParse({ ...admin, role: 'SUPERVISOR' }).success, false)
assert.equal(UserSchema.safeParse({ ...admin, role: undefined }).success, false)
assert.equal(UserSchema.safeParse({ ...admin, role: 'FINANCE' }).success, true)

console.log('user domain validation passed')
