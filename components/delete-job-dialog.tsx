'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'

import { deleteJob, type Job } from '@/lib/data-client'
import { jobLabel } from '@/domain/job/numbering'

// Dialog konfirmasi hapus job — dipakai halaman detail job dan halaman event (menu baris job).
// Pemanggil memegang state `open`; navigasi/refresh daftar dilakukan lewat `onDeleted`.

export function DeleteJobDialog({
  job,
  open,
  onClose,
  onDeleted,
}: {
  job: Job
  open: boolean
  onClose: () => void
  onDeleted: (job: Job) => void
}) {
  const [deleting, setDeleting] = useState(false)
  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteJob(job.id)
      onDeleted(job)
    } catch (caught) {
      window.dispatchEvent(
        new CustomEvent('vss:toast', {
          detail: {
            message: caught instanceof Error ? caught.message : 'Job tidak dapat dihapus.',
            tone: 'error',
          },
        }),
      )
      setDeleting(false)
    }
  }
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onMouseDown={(mouseEvent) => {
        if (!deleting && mouseEvent.target === mouseEvent.currentTarget) onClose()
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-job-title"
        className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
            <AlertTriangle size={22} />
          </div>
          <div>
            <h2 id="delete-job-title" className="text-lg font-bold">
              Hapus job?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              <span className="font-semibold">{jobLabel(job)}</span> beserta lampiran dokumen, baris
              CIPL, dan tiket yang terikat padanya akan dihapus permanen. Tindakan ini tidak dapat
              dibatalkan.
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={deleting} className="btn-secondary">
            Batal
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {deleting ? 'Menghapus...' : 'Hapus permanen'}
          </button>
        </div>
      </div>
    </div>
  )
}
