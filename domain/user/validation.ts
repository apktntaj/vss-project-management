import { z } from 'zod'

export const UserSchema = z.object({
  nama: z.string().trim().min(1, 'Nama wajib diisi.'),
  email: z.string().trim().toLowerCase().email('Format email tidak valid.'),
  password: z.string().min(1, 'Password wajib diisi.'),
  isAdmin: z.boolean(),
})

export const PasswordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Kata sandi saat ini wajib diisi.'),
  newPassword: z.string().min(8, 'Kata sandi baru minimal 8 karakter.'),
})

export type PasswordChangeInput = z.infer<typeof PasswordChangeSchema>
