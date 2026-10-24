'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, ChevronRight, Package, FolderKanban, X } from 'lucide-react'

import type { LocalEvent } from '@/lib/data-client'

/**
 * Dialog routing "Job baru": pilih kategori job dulu (Event / General Cargo / Project).
 * Job event lahir di dalam konteks eventnya — memilih event mengarahkan ke halaman detail
 * event dengan ?newJob=1 yang langsung membuka form inisiasi job di sana.
 * General Cargo dan Project menyusul.
 */
export function NewJobDialog({ events, onClose }: { events: LocalEvent[]; onClose: () => void }) {
  const router = useRouter()
  const [step, setStep] = useState<'category' | 'event'>('category')

  const sortedEvents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return [...events].sort((a, b) => {
      const aActive = a.endsOn >= today
      const bActive = b.endsOn >= today
      if (aActive !== bActive) return aActive ? -1 : 1
      return a.officialName.localeCompare(b.officialName)
    })
  }, [events])

  function openEventJobForm(eventId: string) {
    onClose()
    router.push(`/events/${eventId}?newJob=1`)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) onClose()
      }}
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key === 'Escape') onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-job-title"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-black/10 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="new-job-title" className="text-lg font-bold">
              Job baru
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {step === 'category' ? 'Pilih kategori job.' : 'Pilih event untuk job ini.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {step === 'category' ? (
          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={() => setStep('event')}
              className="flex w-full items-center gap-3 rounded-xl border border-black/10 px-4 py-3 text-left hover:border-orange-300 hover:bg-orange-50"
            >
              <CalendarDays size={18} className="shrink-0 text-orange-700" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900">Event</span>
                <span className="block text-xs text-slate-500">
                  Job pameran: temporary, ATA carnet, road shipment, permanent import, local.
                </span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
            </button>
            <div className="flex w-full items-center gap-3 rounded-xl border border-dashed border-black/15 px-4 py-3 opacity-70">
              <Package size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-500">General Cargo</span>
                <span className="block text-xs text-slate-400">Menyusul.</span>
              </span>
            </div>
            <div className="flex w-full items-center gap-3 rounded-xl border border-dashed border-black/15 px-4 py-3 opacity-70">
              <FolderKanban size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-500">Project</span>
                <span className="block text-xs text-slate-400">Menyusul.</span>
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-2">
            {sortedEvents.length === 0 ? (
              <p className="rounded-xl border border-dashed border-black/15 px-4 py-3 text-sm text-slate-500">
                Belum ada event. Buat event dulu di halaman Events.
              </p>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {sortedEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => openEventJobForm(event.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-black/10 px-4 py-3 text-left hover:border-orange-300 hover:bg-orange-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {event.officialName}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {event.startsAt.slice(0, 10)} – {event.endsOn.slice(0, 10)}
                      </span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setStep('category')}
              className="mt-2 text-sm font-semibold text-orange-700 hover:text-orange-800"
            >
              Kembali
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
