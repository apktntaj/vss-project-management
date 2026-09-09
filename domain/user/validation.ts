import { z } from 'zod'

export const UserSchema = z.object({
  nama: z.string().trim().min(1, 'Nama wajib diisi.'),
  email: z.string().trim().toLowerCase().email('Format email tidak valid.'),
  password: z.string().min(1, 'Password wajib diisi.'),
  isAdmin: z.boolean(),
})
