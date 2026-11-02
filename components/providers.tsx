'use client'

import type { Session } from 'next-auth'
import { SessionProvider } from 'next-auth/react'

// Mengapa: komponen klien (kartu akses event, kolom tagihan) menggerbang UI lewat `useSession()`
// (id/role/isAdmin). Sesi diteruskan dari layout server agar tidak ada fetch awal `/api/auth/session`.
export function Providers({
  children,
  session,
}: {
  children: React.ReactNode
  session: Session | null
}) {
  return <SessionProvider session={session}>{children}</SessionProvider>
}
