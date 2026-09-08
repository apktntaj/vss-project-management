import 'server-only'
import type { PublicUser, User } from '@/domain/user/types'
import { UserSchema } from '@/domain/user/validation'

export const MOCK_USERS: readonly User[] = [
  {
    nama: 'Nurul Handayani',
    email: 'admin@vss.demo',
    password: 'nurulhandayani',
    isAdmin: true,
  },
  {
    nama: 'Andy',
    email: 'operasional@vss.demo',
    password: 'andyandyandy',
    isAdmin: false,
  },
  {
    nama: 'Kevin',
    email: 'viewer@vss.demo',
    password: 'kevinkevin',
    isAdmin: false,
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

export function listDemoUsers(): PublicUser[] {
  return users.map(withoutPassword)
}

export function addDemoUser(
  input: unknown,
): { ok: true; user: PublicUser } | { ok: false; error: string } {
  const parsed = UserSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Data user tidak valid.' }
  }
  if (users.some((user) => user.email === parsed.data.email)) {
    return { ok: false, error: 'Email sudah digunakan.' }
  }

  users.push(parsed.data)
  return { ok: true, user: withoutPassword(parsed.data) }
}
