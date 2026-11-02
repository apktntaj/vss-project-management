import type { Role } from '@/domain/auth/types'

export type User = {
  nama: string
  email: string
  password: string
  isAdmin: boolean
  role: Role
}

export type PublicUser = Omit<User, 'password'>
