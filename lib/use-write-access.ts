'use client'

// Mengapa: hak tulis pengguna login (kaitan dengan event + jenis job yang dipegang) dimuat sekali per
// mount halaman, lalu dipakai keputusan murni di `lib/write-access.ts`. Gagal memuat TIDAK memunculkan
// toast: alasannya tampil saat pengguna mencoba menulis (GAGAL_MUAT).

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

import { getMyWriteAccess } from '@/lib/data-client'
import type { WriteAccess } from '@/lib/write-access'

export function useWriteAccess(): WriteAccess {
  const user = useSession().data?.user
  const userId = user?.id
  const role = user?.role
  const isAdmin = Boolean(user?.isAdmin)
  const [wa, setWa] = useState<WriteAccess>(
    userId && role ? { kind: 'LOADING' } : { kind: 'UNAVAILABLE' },
  )

  useEffect(() => {
    // Sesi lama tanpa `role`: tidak ada yang dimuat.
    if (!userId || !role) return
    let active = true
    getMyWriteAccess()
      .then((access) => {
        if (active) setWa({ kind: 'READY', actor: { id: userId, role, isAdmin }, access })
      })
      .catch(() => {
        if (active) setWa({ kind: 'UNAVAILABLE' })
      })
    return () => {
      active = false
    }
  }, [userId, role, isAdmin])

  return wa
}
