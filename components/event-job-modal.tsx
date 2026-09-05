'use client'

import { useState } from 'react'
import { FileUp, PackagePlus, X } from 'lucide-react'
import { saveJob, saveJobDocument, type LocalEvent, type LocalJob } from '@/lib/indexeddb'

export function EventJobModal({
  event,
  onSaved,
  onCancel,
}: {
  event: LocalEvent
  onSaved: (job: LocalJob) => void
  onCancel: () => void
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function selectFile(file: File | undefined) {
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setSelectedFile(null)
      setError('Format file tidak didukung. Upload dokumen PDF B/L atau AWB.')
      return
    }
    setError('')
    setSelectedFile(file)
  }

  async function submit() {
    if (!selectedFile) {
      setError('Pilih file PDF B/L atau AWB terlebih dahulu.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const job = await saveJob({
        awbNumber: null,
        blNumber: null,
        type: 'IMPORT',
        clientName: 'Menunggu ekstraksi dari dokumen',
        clientInfo: null,
        status: 'DRAFT',
        notes: 'Informasi job dan exhibitor akan diproses dari dokumen B/L atau AWB.',
        assignedToId: null,
        eventId: event.id,
        exhibitorId: null,
        sourceDocumentName: selectedFile.name,
      })
      await saveJobDocument(job.id, selectedFile)
      onSaved(job)
    } catch {
      setError('Tidak dapat menyimpan dokumen PDF di IndexedDB.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 sm:p-8"
      role="presentation"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-event-job-title"
        className="card flex h-[680px] max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between border-b px-6 py-5 sm:px-8">
          <div>
            <h2 id="add-event-job-title" className="mt-1 text-xl font-bold">
              New job
            </h2>
            <p className="mt-1 text-sm text-slate-500">{event.officialName}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Tutup modal tambah job"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-black"
          >
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-8">
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm leading-6 text-orange-900">
            Upload B/L, AWB atau dokumen lainnya untuk membuat draft job.
          </div>
          <label className="mt-6 flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 text-center transition hover:border-orange-400 hover:bg-orange-50">
            <FileUp className="text-orange-600" size={30} />
            <span className="mt-3 font-semibold text-slate-800">Pilih dokumen B/L atau AWB</span>
            <span className="mt-1 text-sm text-slate-500">Hanya file PDF yang diterima</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(input) => selectFile(input.target.files?.[0])}
              className="sr-only"
            />
          </label>
          {selectedFile && (
            <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-semibold text-emerald-900">{selectedFile.name}</p>
                <p className="mt-1 text-xs text-emerald-700">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · PDF
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="shrink-0 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
              >
                Ganti file
              </button>
            </div>
          )}
          {error && <p className="mt-4 text-sm text-rose-700">{error}</p>}
        </div>
        <div className="flex shrink-0 justify-end gap-3 border-t px-6 py-4 sm:px-8">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Batal
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !selectedFile}
            className="btn-primary"
          >
            <PackagePlus size={16} /> {saving ? 'Mengunggah...' : 'Buat job dari dokumen'}
          </button>
        </div>
      </div>
    </div>
  )
}
