'use client'

import { CalendarDays, ChevronRight, Package, FolderKanban, X } from 'lucide-react'

import { internationalJobJenisLabels } from '@/domain/job/types'

/**
 * Dialog routing "Job baru": pilih kategori job (Event / General Cargo / Project).
 * Memilih Event membuka wizard pembuatan job di pemanggil. General Cargo dan Project menyusul.
 */
export function NewJobDialog({
  onClose,
  onSelectCategory,
}: {
  onClose: () => void
  onSelectCategory: (category: 'EVENT') => void
}) {
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
            <p className="mt-1 text-sm text-slate-500">Pilih kategori job.</p>
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

        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={() => onSelectCategory('EVENT')}
            className="flex w-full items-center gap-3 rounded-xl border border-black/10 px-4 py-3 text-left hover:border-orange-300 hover:bg-orange-50"
          >
            <CalendarDays size={18} className="shrink-0 text-orange-700" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-900">Event</span>
              <span className="block text-xs text-slate-500">
                Job pameran: {[...Object.values(internationalJobJenisLabels), 'Local'].join(', ')}.
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
      </div>
    </div>
  )
}
