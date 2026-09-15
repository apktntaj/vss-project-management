import type { PublicUser, User } from './types'

/** Users is a finite collection of users. */
export type Users = readonly User[]

// normalizeEmail : String -> String
// Produces the canonical email representation used by user rules.
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

// toPublicUser : User -> PublicUser
// Removes credentials before a user crosses the domain's public boundary.
export function toPublicUser(user: User): PublicUser {
  const { password: _password, ...publicUser } = user
  return publicUser
}

// createUser : Users User -> User*
// Adds user to users when its canonical email is not already present.
// Does not mutate users; throws when the email is already registered.
export function createUser(users: Users, user: User): User[] {
  const email = normalizeEmail(user.email)

  if (users.some((candidate) => normalizeEmail(candidate.email) === email)) {
    throw new Error('Email sudah digunakan.')
  }

  return [...users, { ...user, email }]
}

// authenticateUser : Users String String -> (PublicUser | null)
// Finds a user by canonical email and exact password, without returning its password.
export function authenticateUser(users: Users, email: string, password: string): PublicUser | null {
  const user = users.find(
    (candidate) =>
      normalizeEmail(candidate.email) === normalizeEmail(email) && candidate.password === password,
  )

  return user ? toPublicUser(user) : null
}
