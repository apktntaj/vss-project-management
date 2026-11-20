'use client'

// Mengapa: leaf KLIEN untuk aksi interaktif sebuah kartu event (menu edit/hapus). Dipisah dari
// EventCard (Server Component) agar batas server/klien tegas (Req 3.1): presentasi statis tetap di
// server, hanya interaktivitas yang 'use client'. Leaf ini TIDAK mengimpor modul server-only
// (`@/features/events`, `@/features/auth`, `@/lib/server/*`, Supabase) — mutasi berjalan lewat
// `fetch('/api/events/[eventId]', { cache: 'no-store' })` lalu `router.refresh()` agar RSC membaca
// ulang data terbaru (Req 2.3/2.4/3.3). Umpan balik hasil memakai helper toast bersama.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Menu } from '@base-ui/react/menu'
import { Archive, MoreVertical, Pencil, Trash2 } from 'lucide-react'

import { toast } from '@/components/toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  /** Boleh Edit dan Arsipkan. Invariant: canUpdate atau canDelete, dijaga pemanggil. */
  canUpdate: boolean
  /** Boleh Hapus. */
  canDelete: boolean
}

/**
 * Menu aksi kartu: buka modal edit, arsipkan, atau hapus event. Arsip/hapus memanggil endpoint
 * lalu me-refresh RSC; sukses/gagal diumpanbalikkan lewat toast. Pesan error dibaca dari field
 * `error` respons.
 */
export function EventCardActions({
  event,
  lifecycle,
  venues,
  organizers,
  pics,
  canUpdate,
  canDelete,
}: EventCardActionsProps) {
  const router = useRouter()
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
      {/* Menu base-ui: dirender di portal (tidak terpotong tabel overflow), navigasi panah, Esc
          menutup, fokus kembali ke tombol. */}
      <Menu.Root>
        <Menu.Trigger
          aria-label={`Menu aksi untuk ${event.name}`}
          className="rounded-lg p-2 text-slate-600 hover:bg-orange-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        >
          <MoreVertical size={20} aria-hidden="true" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="end" sideOffset={4} className="z-50">
            <Menu.Popup
              aria-label={`Aksi untuk ${event.name}`}
              className="w-44 overflow-hidden rounded-xl border border-black/10 bg-white py-1 shadow-lg outline-none"
            >
              {canUpdate ? (
                <Menu.Item
                  onClick={() => setEditing(true)}
                  className="flex cursor-default items-center gap-2.5 px-3 py-2 text-sm text-slate-700 outline-none data-[highlighted]:bg-slate-100"
                >
                  <Pencil size={15} aria-hidden="true" /> Edit
                </Menu.Item>
              ) : null}
              {canUpdate && lifecycle !== 'ARCHIVED' ? (
                <Menu.Item
                  onClick={() => setConfirmingArchive(true)}
                  className="flex cursor-default items-center gap-2.5 px-3 py-2 text-sm text-slate-700 outline-none data-[highlighted]:bg-slate-100"
                >
                  <Archive size={15} aria-hidden="true" /> Arsipkan
                </Menu.Item>
              ) : null}
              {canDelete ? (
                <Menu.Item
                  onClick={() => setConfirmingDelete(true)}
                  className="flex cursor-default items-center gap-2.5 px-3 py-2 text-sm text-rose-700 outline-none data-[highlighted]:bg-rose-50"
                >
                  <Trash2 size={15} aria-hidden="true" /> Hapus
                </Menu.Item>
              ) : null}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

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

      {/* Dialog konfirmasi: focus trap, Esc, dan pengembalian fokus dari primitif Dialog. Selama
          permintaan berjalan, penutupan (Esc/klik luar) ditahan agar hasil tidak hilang. */}
      <Dialog
        open={confirmingArchive}
        onOpenChange={(next) => {
          if (!next && !archiving) setConfirmingArchive(false)
        }}
      >
        <DialogContent role="alertdialog" showCloseButton={false} className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Arsipkan event?</DialogTitle>
            <DialogDescription className="leading-6 text-slate-600">
              <span className="font-semibold">{event.name}</span> akan ditandai sebagai Diarsipkan.
              Data event dan job tetap utuh; status dapat dibedakan lewat badge pada daftar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
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
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <Archive size={15} aria-hidden="true" />
              {archiving ? 'Mengarsipkan…' : 'Arsipkan'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmingDelete}
        onOpenChange={(next) => {
          if (!next && !deleting) setConfirmingDelete(false)
        }}
      >
        <DialogContent role="alertdialog" showCloseButton={false} className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Hapus event?</DialogTitle>
            <DialogDescription className="leading-6 text-slate-600">
              <span className="font-semibold">{event.name}</span> akan dihapus. Tindakan ini tidak
              dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
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
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {deleting ? 'Menghapus…' : 'Hapus'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
