export type Role = 'CS' | 'STAFF' | 'OPERATIONS' | 'DOCUMENT_ASSISTANT' | 'FINANCE'
export const ROLES = [
  'CS',
  'STAFF',
  'OPERATIONS',
  'DOCUMENT_ASSISTANT',
  'FINANCE',
] as const satisfies readonly Role[]

/** Label tampilan peran (Indonesia) untuk UI manajemen user. */
export const ROLE_LABELS: Record<Role, string> = {
  CS: 'CS (PIC event)',
  STAFF: 'Staff',
  OPERATIONS: 'Operations',
  DOCUMENT_ASSISTANT: 'Document assistant',
  FINANCE: 'Finance',
}

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

export type CurrentUser = { id: string; role: Role; workspaceId: string; isAdmin: boolean }

export type AuthenticatedPrincipal = CurrentUser & {
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
