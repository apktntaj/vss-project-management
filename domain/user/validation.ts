import { z } from 'zod'

import { ROLES, type Role } from '@/domain/auth/types'
import { jobJenisValues, type JobJenis } from '@/domain/job/types'

// Modul murni dan aman di klien: hanya zod, domain/auth/types, dan domain/job/types.

/** Daftar jenis yang disimpan: kosong untuk non-spesialis, tanpa duplikat untuk spesialis. */
export function normalizeHandledJenis(role: Role, handled: readonly JobJenis[]): JobJenis[] {
  if (role !== 'SPESIALIS') return []
  return [...new Set(handled)]
}

/** Pesan validasi bila spesialis tidak memegang satu jenis pun. */
export function handledJenisError(role: Role, handled: readonly JobJenis[]): string | null {
  if (role === 'SPESIALIS' && handled.length === 0) {
    return 'Spesialis wajib memegang minimal satu jenis job.'
  }
  return null
}

export const UserSchema = z.object({
  nama: z.string().trim().min(1, 'Nama wajib diisi.'),
  email: z.string().trim().toLowerCase().email('Format email tidak valid.'),
  password: z.string().min(1, 'Password wajib diisi.'),
  isAdmin: z.boolean(),
  role: z.enum(ROLES, { errorMap: () => ({ message: 'Peran tidak valid.' }) }),
  handledJobJenis: z.array(z.enum(jobJenisValues)).default([]),
})

function checkHandledJenis(input: { role: Role; handledJobJenis: readonly JobJenis[] }, ctx: z.RefinementCtx) {
  const message = handledJenisError(input.role, input.handledJobJenis)
  if (message !== null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ['handledJobJenis'] })
  }
}

function normalizeUser<T extends { role: Role; handledJobJenis: readonly JobJenis[] }>(input: T): T & { handledJobJenis: JobJenis[] } {
  return { ...input, handledJobJenis: normalizeHandledJenis(input.role, input.handledJobJenis) }
}

export const userCreateSchema = UserSchema.superRefine(checkHandledJenis).transform(normalizeUser)

export const userUpdateSchema = UserSchema.extend({
  password: z.string().min(1, 'Password wajib diisi.').optional(),
})
  .superRefine(checkHandledJenis)
  .transform(normalizeUser)

export const PasswordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Kata sandi saat ini wajib diisi.'),
  newPassword: z.string().min(8, 'Kata sandi baru minimal 8 karakter.'),
})

export type PasswordChangeInput = z.infer<typeof PasswordChangeSchema>
