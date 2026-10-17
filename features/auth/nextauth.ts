import 'server-only'

// Mengapa: titik tunggal konfigurasi NextAuth v5 PENUH (server-side) untuk slice auth BARU (DD-A4
// clean cutover). Modul ini berdiri sendiri — ia TIDAK mengimpor `auth.ts` lama (`isAdmin`,
// demo-users). Ia men-spread base config edge-safe (`auth.config.ts`) dan MENAMBAHKAN provider
// Credentials; provider itu menarik repository → Supabase → `node:crypto`, karena itu ia TIDAK
// boleh masuk ke base config yang dipakai `middleware.ts` di edge. Strategi sesi JWT dan callback
// `jwt`/`session` diwarisi dari base config agar edge dan server tidak divergen.
// `import 'server-only'` di atas menjaga modul ini tak pernah masuk bundle browser (Req 3.2, 20.2).

import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { authConfig } from '@/features/auth/auth.config'
import { authenticateCredential } from '@/features/auth/repository'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      // Verifikasi kredensial didelegasikan penuh ke repository slice: ia memvalidasi bentuk,
      // mencocokkan password waktu-konstan, dan mereduksi ke CurrentUser. Plaintext tidak pernah
      // di-log maupun dikembalikan. Kegagalan apa pun → null (NextAuth menolak sign-in).
      async authorize(credentials) {
        const email = typeof credentials?.email === 'string' ? credentials.email : ''
        const password = typeof credentials?.password === 'string' ? credentials.password : ''

        const principal = await authenticateCredential({ email, password })
        if (!principal) return null

        // `id` dibawa lewat token.sub oleh NextAuth; `role`/`workspaceId`/`isAdmin` disalin di
        // callback jwt yang didefinisikan bersama di `auth.config.ts`. Semua field dikembalikan
        // di sini supaya objek user sign-in membawa klaim lengkap yang diharapkan konsumen
        // (Req 3.4, Design: Expected_Behavior).
        return { id: principal.id, role: principal.role, workspaceId: principal.workspaceId, isAdmin: principal.isAdmin }
      },
    }),
  ],
})
