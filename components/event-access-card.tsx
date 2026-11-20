'use client'

import { useCallback, useEffect, useState } from 'react'
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
 * Kartu "Akses event": PIC event (dan admin) memberi/mencabut akses ke pengguna CS/Spesialis.
 * Pemanggil hanya merender kartu ini bila `canManageEventAccess`; server tetap menegakkan aturan
 * yang sama (403).
 */
export function EventAccessCard({ eventId }: { eventId: string }) {
  const [view, setView] = useState<EventAccessView | null>(null)
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setView(await listEventAccess(eventId))
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Akses event tidak dapat dimuat.', 'error')
    }
  }, [eventId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function grant() {
    if (!selected) return
    setBusy(true)
    try {
      await grantEventAccess(eventId, selected)
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
      await revokeEventAccess(eventId, userId)
      toast('Akses event dicabut.', 'success')
      await refresh()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Akses event tidak dapat dicabut.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card p-6 sm:p-8" aria-labelledby="event-access-heading">
      <div className="flex items-center gap-2">
        <KeyRound size={18} className="text-slate-600" aria-hidden="true" />
        <h2 id="event-access-heading" className="text-lg font-semibold">
          Akses event
        </h2>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Pengguna yang diberi akses dapat membuat job di event ini dan mengurus job miliknya sendiri.
        Data event tetap hanya dapat diubah PIC event dan admin.
      </p>

      <ul className="mt-4 divide-y divide-slate-100 text-sm">
        {view === null ? (
          <li className="py-2 text-slate-500" role="status">
            Memuat akses…
          </li>
        ) : view.grantees.length === 0 ? (
          <li className="py-2 text-slate-500">Belum ada pengguna yang diberi akses.</li>
        ) : (
          view.grantees.map((grantee) => (
            <li key={grantee.userId} className="flex items-center justify-between py-2">
              <span className="font-medium text-slate-800">{grantee.fullName}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void revoke(grantee.userId)}
                className="btn-secondary"
                aria-label={`Cabut akses ${grantee.fullName}`}
              >
                <Trash2 size={14} aria-hidden="true" /> Cabut
              </button>
            </li>
          ))
        )}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label htmlFor="event-access-candidate" className="sr-only">
          Pilih pengguna
        </label>
        <select
          id="event-access-candidate"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="input min-w-[14rem]"
          aria-describedby="event-access-help"
        >
          <option value="">Pilih pengguna…</option>
          {view?.candidates.map((member) => (
            <option key={member.id} value={member.id}>
              {member.fullName}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy || selected === ''}
          onClick={() => void grant()}
          className="btn-primary"
        >
          Beri akses
        </button>
      </div>
      <p id="event-access-help" className="mt-2 text-xs text-slate-500">
        Hanya pengguna CS dan Spesialis yang dapat dipilih.
      </p>
    </section>
  )
}
