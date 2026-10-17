'use client'

// Mengapa: leaf KLIEN pemicu modal buat-event. Halaman dashboard adalah Server Component, jadi
// tombol yang membuka modal (butuh state klien) harus hidup di leaf terpisah. Leaf ini hanya
// mengelola buka/tutup modal; mutasi nyata dilakukan EventFormModal lewat `fetch` + `router.refresh`
// (lihat komentar di sana). Tidak ada impor modul server-only.

import { useState } from 'react'
import { Plus } from 'lucide-react'

import {
  EventFormModal,
  type EventFormOptions,
} from '@/features/events/components/event-form-modal'

type EventCreateButtonProps = EventFormOptions

/** Tombol "Event baru" + modal buat event. Opsi master data diteruskan apa adanya ke modal. */
export function EventCreateButton({ venues, organizers, pics }: EventCreateButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary shrink-0">
        <Plus size={16} aria-hidden="true" /> <span className="ml-2">Event baru</span>
      </button>
      {open ? (
        <EventFormModal
          venues={venues}
          organizers={organizers}
          pics={pics}
          onClose={() => setOpen(false)}
          onSaved={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}
