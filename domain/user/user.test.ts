import assert from 'node:assert/strict'
import { authenticateUser, createUser, toPublicUser, type Users } from './user'
import type { User } from './types'

const admin: User = {
  nama: 'Admin Demo VSS',
  email: 'admin@vss.demo',
  password: 'demo-vss-2026',
  isAdmin: true,
}

const users: Users = [admin]

const createdUsers = createUser(users, {
  nama: 'Operator',
  email: ' OPERATOR@VSS.DEMO ',
  password: 'operator-secret',
  isAdmin: false,
})

assert.equal(createdUsers.length, 2)
assert.equal(createdUsers[1]?.email, 'operator@vss.demo')
assert.equal(users.length, 1)

assert.throws(
  () => createUser(users, { ...admin, email: ' ADMIN@VSS.DEMO ' }),
  { message: 'Email sudah digunakan.' },
)

const authenticated = authenticateUser(users, ' ADMIN@VSS.DEMO ', admin.password)
assert.deepEqual(authenticated, {
  nama: admin.nama,
  email: admin.email,
  isAdmin: true,
})
assert.equal(authenticated && 'password' in authenticated, false)
assert.equal(authenticateUser(users, admin.email, 'wrong-password'), null)
assert.deepEqual(toPublicUser(admin), {
  nama: admin.nama,
  email: admin.email,
  isAdmin: true,
})

console.log('user domain logic passed')
