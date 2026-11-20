import 'server-only'
import type { PublicUser, User } from '@/domain/user/types'
import { userCreateSchema, userUpdateSchema } from '@/domain/user/validation'

export const MOCK_USERS: readonly User[] = [
  {
    nama: 'Nurul Handayani',
    email: 'admin@vss.demo',
    password: 'nurulhandayani',
    isAdmin: true,
    role: 'CS',
    handledJobJenis: [],
  },
  {
    nama: 'Andy',
    email: 'operasional@vss.demo',
    password: 'andyandyandy',
    isAdmin: false,
    role: 'CS',
    handledJobJenis: [],
  },
  {
    nama: 'Kevin',
    email: 'viewer@vss.demo',
    password: 'kevinkevin',
    isAdmin: false,
    role: 'FINANCE',
    handledJobJenis: [],
  },
]

const globalUserStore = globalThis as typeof globalThis & { __vssDemoUsers?: User[] }
const users = (globalUserStore.__vssDemoUsers ??= MOCK_USERS.map((user) => ({ ...user })))

function withoutPassword(user: User): PublicUser {
  const { password: _password, ...publicUser } = user
  return publicUser
}

export function authenticateDemoUser(email: string, password: string): PublicUser | null {
  const user = users.find(
    (candidate) =>
      candidate.email === email.trim().toLowerCase() && candidate.password === password,
  )
  return user ? withoutPassword(user) : null
}

type DemoUserFailure = { ok: false; error: string; field?: 'handledJobJenis' }

// Bentuk galat yang sama dengan `settingsValidationBody` di app/api/settings/route.ts.
function validationFailure(issue: { message: string; path: readonly (string | number)[] } | undefined): DemoUserFailure {
  const error = issue?.message ?? 'Data user tidak valid.'
  return issue?.path[0] === 'handledJobJenis' ? { ok: false, error, field: 'handledJobJenis' } : { ok: false, error }
}

export function listDemoUsers(): PublicUser[] {
  return users.map(withoutPassword)
}

export function addDemoUser(
  input: unknown,
): { ok: true; user: PublicUser } | DemoUserFailure {
  const parsed = userCreateSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error.issues[0])
  if (users.some((user) => user.email === parsed.data.email)) {
    return { ok: false, error: 'Email sudah digunakan.' }
  }

  users.push(parsed.data)
  return { ok: true, user: withoutPassword(parsed.data) }
}

export function updateDemoUser(
  email: string,
  input: unknown,
): { ok: true; user: PublicUser } | DemoUserFailure {
  const candidate = users.find((user) => user.email === email)
  if (!candidate) return { ok: false, error: 'User tidak ditemukan.' }
  const parsed = userUpdateSchema.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error.issues[0])
  if (parsed.data.email !== email && users.some((user) => user.email === parsed.data.email)) {
    return { ok: false, error: 'Email sudah digunakan.' }
  }
  candidate.nama = parsed.data.nama
  candidate.email = parsed.data.email
  candidate.isAdmin = parsed.data.isAdmin
  candidate.role = parsed.data.role
  candidate.handledJobJenis = parsed.data.handledJobJenis
  if (parsed.data.password) candidate.password = parsed.data.password
  return { ok: true, user: withoutPassword(candidate) }
}
