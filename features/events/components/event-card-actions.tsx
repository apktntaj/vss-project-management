'use client'

// Mengapa: leaf KLIEN untuk aksi interaktif sebuah kartu event (menu edit/hapus). Dipisah dari
// EventCard (Server Component) agar batas server/klien tegas (Req 3.1): presentasi statis tetap di
// server, hanya interaktivitas yang 'use client'. Leaf ini TIDAK mengimpor modul server-only
// (`@/features/events`, `@/features/auth`, `@/lib/server/*`, Supabase) — mutasi berjalan lewat
// `fetch('/api/events/[eventId]', { cache: 'no-store' })` lalu `router.refresh()` agar RSC membaca
// ulang data terbaru (Req 2.3/2.4/3.3). Umpan balik hasil memakai helper toast bersama.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, MoreVertical, Pencil, Trash2 } from 'lucide-react'

import { toast } from '@/components/toast'
import {
  EventFormModal,
  type EventFormOptions,
  type EventFormValues,
} from '@/features/events/components/event-form-modal'
import type { EventLifecycle } from '@/domain/event/types'

type EventCardActionsProps = EventFormOptions & {
  event: EventFormValues
  /** Lifecycle baris pemilik aksi: ARCHIVED menyembunyikan item "Arsipkan". */
  lifecycle?: EventLifecycle
}

/**
 * Menu aksi kartu: buka modal edit, arsipkan, atau hapus event. Arsip/hapus memanggil endpoint
 * lalu me-refresh RSC; sukses/gagal diumpanbalikkan lewat toast. Pesan error dibaca dari field
 * `error` respons.
 */
export function EventCardActions({ event, lifecycle, venues, organizers, pics }: EventCardActionsProps) {
  const router = useRouter()
  // Menu di-anchor fixed dari getBoundingClientRect (pola JobRow) supaya tidak terpotong oleh
  // wadah tabel yang overflow-x-auto.
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number } | null>(null)
  const [editing, setEditing] = useState(false)
  const [confirmingArchive, setConfirmingArchive] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleArchive() {
    setArchiving(true)
    try {
      const response = await fetch(`/api/events/${event.id}/archive`, {
        method: 'POST',
        cache: 'no-store',
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? 'Event tidak dapat diarsipkan.')
      }
      toast('Event diarsipkan.', 'success')
      setConfirmingArchive(false)
      router.refresh()
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Event tidak dapat diarsipkan.', 'error')
    } finally {
      setArchiving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const response = await fetch(`/api/events/${event.id}`, {
        method: 'DELETE',
        cache: 'no-store',
      })
      if (!response.ok && response.status !== 204) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? 'Event tidak dapat dihapus.')
      }
      toast('Event dihapus.', 'success')
      setConfirmingDelete(false)
      router.refresh()
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Event tidak dapat dihapus.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={(clickEvent) => {
          const rect = clickEvent.currentTarget.getBoundingClientRect()
          setMenuAnchor((current) =>
            current ? null : { top: rect.bottom + 4, left: rect.right - 176 },
          )
        }}
        aria-label={`Menu aksi untuk ${event.name}`}
        aria-expanded={menuAnchor !== null}
        aria-haspopup="menu"
        className="rounded-lg p-2 text-slate-500 hover:bg-orange-50 hover:text-orange-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
      >
        <MoreVertical size={20} aria-hidden="true" />
      </button>

      {menuAnchor ? (
        <>
          <div
            className="fixed inset-0 z-40"
            role="presentation"
            onClick={() => setMenuAnchor(null)}
          />
          <div
            role="menu"
            aria-label={`Aksi untuk ${event.name}`}
            className="fixed z-50 w-44 overflow-hidden rounded-xl border border-black/10 bg-white py-1 shadow-lg"
            style={{ top: menuAnchor.top, left: menuAnchor.left }}
          >
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setMenuAnchor(null)
                setEditing(true)
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <Pencil size={15} aria-hidden="true" /> Edit
            </button>
            {lifecycle !== 'ARCHIVED' ? (
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setMenuAnchor(null)
                  setConfirmingArchive(true)
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <Archive size={15} aria-hidden="true" /> Arsipkan
              </button>
            ) : null}
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setMenuAnchor(null)
                setConfirmingDelete(true)
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
            >
              <Trash2 size={15} aria-hidden="true" /> Hapus
            </button>
          </div>
        </>
      ) : null}

      {editing ? (
        <EventFormModal
          event={event}
          venues={venues}
          organizers={organizers}
          pics={pics}
          onClose={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      ) : null}

      {confirmingArchive ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(mouseEvent) => {
            if (!archiving && mouseEvent.target === mouseEvent.currentTarget) {
              setConfirmingArchive(false)
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="archive-event-title"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <h2 id="archive-event-title" className="text-lg font-bold">
              Arsipkan event?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              <span className="font-semibold">{event.name}</span> akan ditandai sebagai Diarsipkan.
              Data event dan job tetap utuh; status dapat dibedakan lewat badge pada daftar.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmingArchive(false)}
                disabled={archiving}
                className="btn-secondary"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleArchive}
                disabled={archiving}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                <Archive size={15} aria-hidden="true" />
                {archiving ? 'Mengarsipkan…' : 'Arsipkan'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmingDelete ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(mouseEvent) => {
            if (!deleting && mouseEvent.target === mouseEvent.currentTarget) {
              setConfirmingDelete(false)
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-event-title"
            className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-2xl"
          >
            <h2 id="delete-event-title" className="text-lg font-bold">
              Hapus event?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              <span className="font-semibold">{event.name}</span> akan dihapus. Tindakan ini tidak
              dapat dibatalkan.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="btn-secondary"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {deleting ? 'Menghapus…' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
