// Mengapa: barrel tipis yang mengekspos batas publik slice auth ke konsumen sisi server
// (use-case, route handler, middleware). Karena ia mere-export modul server-only (nextauth,
// authorize, repository), index.ts ini sendiri EFEKTIF server-only — JANGAN mengimpornya dari
// file `'use client'` mana pun. Konsumen klien tidak butuh apa pun di sini: otorisasi dan sesi
// hidup sepenuhnya di server (Req 3.1, 3.2).

export { can, authorize, requireCurrentUser } from '@/features/auth/authorize'
export type { Capability } from '@/features/auth/authorize'

// Helper NextAuth yang dibutuhkan konsumen server: `auth` untuk membaca sesi, `signIn`/`signOut`
// untuk Server Action auth, `handlers` untuk route NextAuth.
export { auth, signIn, signOut, handlers } from '@/features/auth/nextauth'

// Verifikasi kredensial dipakai oleh use-case sign-in; diekspos di batas slice agar konsumen tidak
// menjangkau repository internal langsung.
export { authenticateCredential } from '@/features/auth/repository'
