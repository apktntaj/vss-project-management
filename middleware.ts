// Mengapa: gerbang AuthN global (Req 1, DD-A7). Satu middleware menjaga seluruh rute terlindungi
// sehingga tidak ada route handler yang bisa terlupa memasang guard sesi. Logika AuthN didelegasi
// ke slice auth lewat base config edge-safe `auth.config.ts`.
//
// CRITICAL — edge runtime: middleware berjalan di Edge, jadi ia TIDAK boleh mengimpor instance
// NextAuth penuh dari `features/auth/nextauth.ts` (yang menarik repository → Supabase →
// `node:crypto` via Credentials). Alih-alih, kita buat instance NextAuth edge BARU dari base
// config yang tanpa provider. Karena itu pula bentuk body 401 di-hardcode di sini alih-alih
// mengimpor `lib/server/errors.ts` yang `server-only` — body-nya tetap identik dengan
// Error_Contract `{ error: '<pesan Indonesia>' }` (Req 8.1).

import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'
import { authConfig } from '@/features/auth/auth.config'

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  // Sesi valid → teruskan ke Server_Component atau Route_Handler tujuan (Req 1.3).
  if (req.auth) return NextResponse.next()

  const { pathname } = req.nextUrl
  const isApiRequest = pathname.startsWith('/api/')

  // Request API tanpa sesi → tolak 401 dengan Error_Contract (Req 1.2). Body di-hardcode agar
  // middleware tidak mengimpor modul server-only; bentuknya identik dengan `toErrorResponse`.
  if (isApiRequest) {
    return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 })
  }

  // Request halaman tanpa sesi → alihkan ke `/login` (Req 1.1).
  return NextResponse.redirect(new URL('/login', req.nextUrl))
})

// Matcher mengecualikan internal Next.js + aset statis, serta rute yang HARUS dapat diakses tanpa
// sesi: halaman `/login` (kalau tidak, redirect loop) dan rute NextAuth sendiri `/api/auth/*`
// (sign-in/out/callback). Semua halaman lain dialihkan dan semua `/api/*` lain membalas 401.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|api/auth).*)'],
}
