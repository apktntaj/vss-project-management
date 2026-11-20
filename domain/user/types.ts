import type { Role } from '@/domain/auth/types'
import type { JobJenis } from '@/domain/job/types'

export type User = {
  nama: string
  email: string
  password: string
  isAdmin: boolean
  role: Role
  /** Jenis job yang dipegang spesialis; kosong untuk peran lain. */
  handledJobJenis: readonly JobJenis[]
}

export type PublicUser = Omit<User, 'password'>
