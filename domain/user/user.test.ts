import { describe, expect, test } from 'bun:test'
import { authenticateUser, createUser, toPublicUser, type Users } from './user'
import type { User } from './types'

const admin: User = {
  nama: 'Admin Demo VSS',
  email: 'admin@vss.demo',
  password: 'demo-vss-2026',
  isAdmin: true,
}

const emptyUsers: Users = []
const users: Users = [admin]

describe('user domain logic', () => {
  test('creates the first user from an empty collection', () => {
    expect(createUser(emptyUsers, admin)).toEqual([admin])
  })

  test('creates a user with a normalized email without mutating the collection', () => {
    const createdUsers = createUser(users, {
      nama: 'Operator',
      email: ' OPERATOR@VSS.DEMO ',
      password: 'operator-secret',
      isAdmin: false,
    })

    expect(createdUsers).toHaveLength(2)
    expect(createdUsers[1]?.email).toBe('operator@vss.demo')
    expect(users).toHaveLength(1)
  })

  test('rejects duplicate emails after normalization', () => {
    expect(() => createUser(users, { ...admin, email: ' ADMIN@VSS.DEMO ' })).toThrow(
      'Email sudah digunakan.',
    )
  })

  test('returns null when no user matches the credentials', () => {
    expect(authenticateUser(emptyUsers, admin.email, admin.password)).toBeNull()
  })

  test('authenticates credentials and returns a public user without password', () => {
    const authenticated = authenticateUser(users, ' ADMIN@VSS.DEMO ', admin.password)

    expect(authenticated).toEqual({
      nama: admin.nama,
      email: admin.email,
      isAdmin: true,
    })
    expect(authenticated).not.toHaveProperty('password')
  })

  test('returns null for an incorrect password', () => {
    expect(authenticateUser(users, admin.email, 'wrong-password')).toBeNull()
  })

  test('projects a user to its public representation', () => {
    expect(toPublicUser(admin)).toEqual({
      nama: admin.nama,
      email: admin.email,
      isAdmin: true,
    })
  })
})
