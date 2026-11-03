// Mengapa: halaman daftar event (RSC) dan export Excel harus memakai TAFSIRAN filter yang sama —
// kalau berbeda, file hasil export tidak cocok dengan yang terlihat di layar. Modul ini murni
// (tanpa React/Supabase) sehingga aman diimpor dari page, route handler, maupun leaf klien.

import type { EventListQuery } from '@/domain/event/types'

/** Baca `search`/`status`/`pic` dari sumber param apa pun (searchParams RSC atau URLSearchParams). */
export function parseEventListQuery(read: (key: string) => string | null | undefined): EventListQuery {
  const search = read('search')?.trim() || undefined
  const status = read('status')
  const pic = read('pic')?.trim() || undefined

  const query: EventListQuery = {}
  if (search) query.search = search
  if (pic) query.picId = pic
  if (status === 'active') {
    query.lifecycle = 'ACTIVE'
  } else if (status === 'soon' || status === 'ongoing' || status === 'done') {
    query.displayStatus = status
  }
  return query
}
