import type { PublicUser, User } from './types'

export type Users = readonly User[]

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function toPublicUser(user: User): PublicUser {
  const { password: _password, ...publicUser } = user
  return publicUser
}

export function createUser(users: Users, user: User): User[] {
  const email = normalizeEmail(user.email)

  if (users.some((candidate) => normalizeEmail(candidate.email) === email)) {
    throw new Error('Email sudah digunakan.')
  }

  return [...users, { ...user, email }]
}

export function authenticateUser(
  users: Users,
  email: string,
  password: string,
): PublicUser | null {
  const user = users.find(
    (candidate) =>
      normalizeEmail(candidate.email) === normalizeEmail(email) &&
      candidate.password === password,
  )

  return user ? toPublicUser(user) : null
}
