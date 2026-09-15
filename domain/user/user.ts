import type { PublicUser, User } from './types'

/** Users is a finite collection of users. */
export type Users = readonly User[]

// isEmailExist : Users String -> Boolean
// Determines whether an already-canonical email belongs to a user in users.
export function isEmailExist(users: Users, email: string): boolean {
  return users.some((candidate) => candidate.email === email)
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
  if (isEmailExist(users, user.email)) {
    throw new Error('Email sudah digunakan.')
  }

  return [...users, user]
}

// authenticateUser : Users String String -> (PublicUser | null)
// Finds a user by canonical email and exact password, without returning its password.
export function authenticateUser(users: Users, email: string, password: string): PublicUser | null {
  const user = users.find(
    (candidate) => candidate.email === email && candidate.password === password,
  )

  return user ? toPublicUser(user) : null
}
