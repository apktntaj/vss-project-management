// Mengapa: konfigurasi dasar NextAuth v5 yang AMAN-EDGE. `middleware.ts` berjalan di Edge runtime
// dan tidak boleh mengimpor kode Node-only/`server-only` secara transitif. Provider Credentials di
// `nextauth.ts` menarik repository → `@supabase/supabase-js` dan `lib/auth/password.ts` →
// `node:crypto`, yang akan memecah build edge. Pola split-config resmi NextAuth v5: taruh HANYA
// opsi edge-compatible di sini (tanpa provider), lalu instance penuh men-spread config ini dan
// menambahkan Credentials. `jwt`/`session` callback hidup di sini juga agar instance edge dan
// instance penuh berbagi logika yang sama tanpa divergensi.
//
// PENTING: modul ini TIDAK boleh `import 'server-only'` (ia dipakai di edge) dan TIDAK boleh
// mengimpor repository, Supabase, `node:crypto`, atau modul password. Hanya tipe murni yang aman.

import type { NextAuthConfig } from 'next-auth'
import type { Role } from '@/domain/auth/types'

// -----------------------------------------------------------------------------
// Tipe untuk callback murni — edge-safe, tanpa dependensi Node/Supabase
// -----------------------------------------------------------------------------

/**
 * JWT token yang dibawa sesi NextAuth v5. Field tambahan di luar standar NextAuth
 * disimpan sebagai index-signature untuk mengakomodasi augmentasi tanpa meledakkan tipe.
 */
export type JwtToken = {
  sub?: string
  role?: string
  workspaceId?: string
  isAdmin?: boolean
  [key: string]: unknown
}

/**
 * User yang dilewatkan ke callback jwt saat sign-in. Field opsional karena
// berbagai jalur (legacy vs baru) mungkin hanya menyediakan sebagian.
 */
export type JwtUser = {
  id: string
  role?: Role
  workspaceId?: string
  isAdmin?: boolean
}

/**
 * User di session yang diproyeksikan dari token. Semua field opsional karena
 * token mungkin tidak lengkap (mis. token legacy yang hanya punya isAdmin).
 */
export type SessionUser = {
  id?: string
  role?: Role
  workspaceId?: string
  isAdmin?: boolean
}

/**
 * Session NextAuth v5 yang dibaca oleh aplikasi.
 */
export type ProjectedSession = {
  user: SessionUser
  expires: string
}

// -----------------------------------------------------------------------------
// Fungsi murni: applyJwtClaims
// -----------------------------------------------------------------------------

/**
 * Salin klaim dari user ke token saat sign-in.
 *
 * **Kapan dipanggil**: Saat `user` hadir di callback jwt (sign-in pertama kali).
 *
 * **Perilaku**:
 * - Saat `user` ada: salin `role`, `workspaceId`, DAN `isAdmin` ke token.
 * - Saat `user` tidak ada: kembalikan token apa adanya (permintaan non-sign-in).
 *
 * **Preservation**: Token tanpa klaim tetap tanpa klaim — fungsi tidak mengisi
 * nilai default atau menghapus field yang sudah ada.
 *
 * @param token - Token JWT saat ini (mutable, akan dimodifikasi in-place)
 * @param user - User dari authorize callback (undefined untuk non-sign-in)
 * @returns Token yang sudah dimodifikasi (sama dengan input untuk chaining)
 */
export function applyJwtClaims(token: JwtToken, user?: JwtUser): JwtToken {
  if (user) {
    token.role = user.role
    token.workspaceId = user.workspaceId
    token.isAdmin = user.isAdmin
  }
  return token
}

// -----------------------------------------------------------------------------
// Fungsi murni: projectSession
// -----------------------------------------------------------------------------

/**
 * Proyeksikan token ke session.user dalam bentuk yang dikonsumsi aplikasi.
 *
 * **Perilaku**:
 * - `id` diambil dari `token.sub` (sumber kanonik), fallback ke `session.user.id`.
 * - `role` dan `workspaceId` diproyeksikan dengan narrowing tipe string → Role/string.
 * - `isAdmin` diproyeksikan sebagai boolean, default `false` jika tidak ada.
 * - Field yang hilang → `role`/`workspaceId` `undefined`, `isAdmin` `false`.
 *
 * **Preservation**: Sesi tanpa `role`/`workspaceId` tetap menghasilkan sesi tanpa
 * kedua field tersebut — narrowing di `requireCurrentUser` akan menolak dengan 401.
 *
 * @param session - Session object dari NextAuth (akan dimodifikasi in-place)
 * @param token - Token JWT yang menyimpan klaim
 * @returns Session yang sudah dimodifikasi (sama dengan input untuk chaining)
 */
export function projectSession(session: ProjectedSession, token: JwtToken): ProjectedSession {
  // NextAuth v5 melonggarkan tipe `token` di callback ini menjadi index-signature, jadi field
  // ter-augmentasi dibaca sebagai `unknown`. Narrowing eksplisit menjaga tsc bersih tanpa
  // melemahkan bentuk sesi yang diproyeksikan.
  session.user.id = token.sub ?? session.user.id
  session.user.role = typeof token.role === 'string' ? (token.role as Role) : undefined
  session.user.workspaceId = typeof token.workspaceId === 'string' ? token.workspaceId : undefined
  session.user.isAdmin = typeof token.isAdmin === 'boolean' ? token.isAdmin : false
  return session
}

// -----------------------------------------------------------------------------
// NextAuth Config — menggunakan fungsi murni di atas
// -----------------------------------------------------------------------------

export const authConfig = {
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  // Provider sengaja kosong di base config: Credentials (yang mengimpor repository) HANYA
  // ditambahkan di instance penuh server-side `nextauth.ts`, bukan di jalur edge.
  providers: [],
  callbacks: {
    // Saat sign-in (objek `user` ada) salin identitas ke token. `token.sub` sudah berisi `user.id`
    // secara default; `role`/`workspaceId`/`isAdmin` dibawa eksplisit agar sesi tak perlu query ulang.
    jwt({ token, user }) {
      return applyJwtClaims(token as JwtToken, user as JwtUser | undefined)
    },
    // Proyeksikan token kembali ke `session.user` dalam bentuk CurrentUser + isAdmin.
    // `token.sub` adalah sumber id yang kanonik.
    session({ session, token }) {
      return projectSession(session as ProjectedSession, token as JwtToken)
    },
  },
} satisfies NextAuthConfig
