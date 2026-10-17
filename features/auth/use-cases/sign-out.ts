'use server'

// Mengapa: `signOutAction` adalah SATU dari HANYA DUA Server Action di sistem (pasangannya adalah
// `signInAction`) — DD-A6 / Req 18.6. Direktif `'use server'` menandai fungsi async yang diekspor
// sebagai Server Action dan menjamin eksekusi server, jadi modul ini TIDAK memakai
// `import 'server-only'` dan BUKAN `'use client'`.

import { signOut } from '@/features/auth/nextauth'

// Mengakhiri sesi dengan menghapus cookie sesi JWT. `redirect: false` menjaga aksi tetap sederhana
// dan serializable — leaf klien yang memutuskan navigasi setelah sukses, konsisten dengan pola
// mutasi lain di repo (tanpa redirect sisi-server implisit).
export async function signOutAction(): Promise<void> {
  await signOut({ redirect: false })
}
