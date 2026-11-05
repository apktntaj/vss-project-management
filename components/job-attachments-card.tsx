'use client'

import { useCallback, useEffect, useState } from 'react'

import {
  getAttachmentContent,
  listJobAttachments,
  type Job,
  type JobAttachmentMeta,
} from '@/lib/data-client'
import { jobDocumentKindLabels, type JobDocumentKind } from '@/domain/job/types'
import { date } from '@/components/job-row'

// Kartu lampiran dokumen job: metadata hasil unggah editor dokumen (scan B/L, scan CIPL, form BC).
// Tanpa hapus per-item — pembersihan lampiran mengikuti penghapusan job.

const fileSizeLabel = (fileSize: number) =>
  fileSize >= 1024 * 1024
    ? `${(fileSize / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(fileSize / 1024))} KB`

export function JobAttachmentsCard({ job }: { job: Job }) {
  const [items, setItems] = useState<JobAttachmentMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Dimuat ulang saat versi job berubah: unggahan lampiran selalu lewat simpan job (PATCH), jadi
  // versi naik tepat setelah lampiran baru tersimpan.
  const load = useCallback(() => {
    setLoading(true)
    setError('')
    listJobAttachments(job.id)
      .then(setItems)
      .catch(() => setError('Lampiran tidak dapat dimuat.'))
      .finally(() => setLoading(false))
  }, [job.id])

  useEffect(() => {
    load()
  }, [load, job.version])

  async function view(item: JobAttachmentMeta) {
    const blob = await getAttachmentContent(item.id)
    if (!blob) {
      window.dispatchEvent(
        new CustomEvent('vss:toast', {
          detail: { message: `Lampiran ${item.fileName} tidak dapat dibuka.`, tone: 'error' },
        }),
      )
      return
    }
    const url = URL.createObjectURL(blob)
    window.open(url)
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  return (
    <section className="card p-5">
      <h2 className="font-semibold">Lampiran dokumen</h2>
      {loading ? (
        <p className="mt-3 text-sm text-slate-500">Memuat lampiran…</p>
      ) : error ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-rose-600">{error}</p>
          <button type="button" className="btn-secondary" onClick={load}>
            Coba lagi
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          Belum ada lampiran. Unggah lewat editor dokumen (scan B/L, scan CIPL, form BC).
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="pb-2 pr-3">Jenis</th>
                <th className="pb-2 pr-3">Nama file</th>
                <th className="pb-2 pr-3">Ukuran</th>
                <th className="pb-2 pr-3">Tanggal</th>
                <th className="pb-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-200/80 last:border-0">
                  <td className="py-2.5 pr-3 font-medium text-slate-800">
                    {item.kind
                      ? (jobDocumentKindLabels[item.kind as JobDocumentKind] ?? item.kind)
                      : 'Tan jenis'}
                  </td>
                  <td className="max-w-56 truncate py-2.5 pr-3 text-slate-700" title={item.fileName}>
                    {item.fileName}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-600">{fileSizeLabel(item.fileSize)}</td>
                  <td className="py-2.5 pr-3 text-slate-600">{date(item.createdAt)}</td>
                  <td className="py-2.5">
                    <button
                      type="button"
                      className="text-xs font-semibold text-orange-700 hover:text-orange-800"
                      onClick={() => void view(item)}
                    >
                      Lihat
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
