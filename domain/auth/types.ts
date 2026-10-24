export type Role = 'STAFF' | 'SUPERVISOR' | 'CUSTOMER_SERVICE' | 'DOCUMENT_ASSISTANT'
export const ROLES = [
  'STAFF',
  'SUPERVISOR',
  'CUSTOMER_SERVICE',
  'DOCUMENT_ASSISTANT',
] as const satisfies readonly Role[]

export type User = {
  id: string
  email: string
  fullName: string
  role: Role
  isAdmin: boolean
  isActive: boolean
  passwordHash: string
  workspaceId: string
}

export type CurrentUser = { id: string; role: Role; workspaceId: string }

export type AuthenticatedPrincipal = CurrentUser & {
  isAdmin: boolean
  email: string
  fullName: string
}

export type Session = {
  user: CurrentUser
  expiresAt: number
}

export type Credential = {
  email: string
  password: string
}

export type ValidatedCredential = {
  email: string
  password: string
}

export type PasswordHashAlgorithm = 'scrypt'

export type ScryptParameters = {
  cost: number
  blockSize: number
  parallelization: number
}

export type ParsedPasswordHash = {
  algorithm: PasswordHashAlgorithm
  parameters: ScryptParameters
  salt: string
  hash: string
}

export type PasswordHasher = {
  hash(password: string): Promise<string>
  verify(password: string, encoded: string): Promise<boolean>
}
