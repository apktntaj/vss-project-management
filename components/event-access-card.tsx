'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { KeyRound, Trash2 } from 'lucide-react'

import {
  grantEventAccess,
  listEventAccess,
  revokeEventAccess,
  type EventAccessView,
} from '@/lib/data-client'

function toast(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}

/**
 * Kartu "Akses event": PIC event (dan admin) memberi/mencabut hak kelola event ke pengguna lain.
 * Penerima akses dapat mengubah/membatalkan/menghapus/mengarsipkan event seperti PIC. Disembunyikan
 * untuk pengguna lain; server tetap menegakkan aturan yang sama (403).
 */
export function EventAccessCard({ event }: { event: { id: string; picId: string | null } }) {
  const { data: session } = useSession()
  const canManage = Boolean(
    session?.user && (session.user.isAdmin || (event.picId && session.user.id === event.picId)),
  )

  const [view, setView] = useState<EventAccessView | null>(null)
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setView(await listEventAccess(event.id))
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Akses event tidak dapat dimuat.', 'error')
    }
  }, [event.id])

  useEffect(() => {
    if (canManage) void refresh()
  }, [canManage, refresh])

  if (!canManage) return null

  async function grant() {
    if (!selected) return
    setBusy(true)
    try {
      await grantEventAccess(event.id, selected)
      toast('Akses event diberikan.', 'success')
      setSelected('')
      await refresh()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Akses event tidak dapat diberikan.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function revoke(userId: string) {
    setBusy(true)
    try {
      await revokeEventAccess(event.id, userId)
      toast('Akses event dicabut.', 'success')
      await refresh()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Akses event tidak dapat dicabut.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card p-6 sm:p-8">
      <div className="flex items-center gap-2">
        <KeyRound size={18} className="text-orange-600" />
        <h2 className="text-lg font-semibold">Akses event</h2>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Pengguna yang diberi akses dapat mengubah, membatalkan, mengarsipkan, atau menghapus event ini.
      </p>

      <ul className="mt-4 divide-y divide-slate-100 text-sm">
        {view?.grantees.length ? (
          view.grantees.map((grantee) => (
            <li key={grantee.userId} className="flex items-center justify-between py-2">
              <span className="font-medium text-slate-800">{grantee.fullName}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void revoke(grantee.userId)}
                className="btn-secondary"
                title="Cabut akses"
              >
                <Trash2 size={14} /> Cabut
              </button>
            </li>
          ))
        ) : (
          <li className="py-2 text-slate-500">Belum ada pengguna yang diberi akses.</li>
        )}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="input min-w-[14rem]"
          aria-label="Pilih pengguna"
        >
          <option value="">Pilih pengguna…</option>
          {view?.candidates.map((member) => (
            <option key={member.id} value={member.id}>
              {member.fullName}
            </option>
          ))}
        </select>
        <button type="button" disabled={busy || !selected} onClick={() => void grant()} className="btn-primary">
          Beri akses
        </button>
      </div>
    </section>
  )
}
