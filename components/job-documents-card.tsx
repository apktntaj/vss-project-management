'use client'

import { useEffect, useState } from 'react'
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'

import { getAttachmentContent, listJobAttachments, type Job, type JobAttachment } from '@/lib/data-client'
import { jobDocumentKindLabels, type JobDocumentKind } from '@/domain/job/types'
import { date } from '@/components/job-row'

function notify(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Dokumen yang sudah diunggah untuk job, disaring per jenis agar tiap tab hanya menampilkan
 * miliknya. Dimuat ulang saat versi job berubah (menyimpan dokumen menaikkan versi).
 */
export function JobDocumentsCard({ job, kinds }: { job: Job; kinds: ReadonlyArray<JobDocumentKind> }) {
  const [attachments, setAttachments] = useState<JobAttachment[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoadError('')
    listJobAttachments(job.id)
      .then((rows) => {
        if (active) setAttachments(rows)
      })
      .catch((caught) => {
        if (!active) return
        setAttachments([])
        setLoadError(caught instanceof Error ? caught.message : 'Dokumen tidak dapat dimuat.')
      })
    return () => {
      active = false
    }
  }, [job.id, job.version])

  const visible = (attachments ?? []).filter((item) => item.kind !== null && kinds.includes(item.kind))

  async function download(item: JobAttachment) {
    setDownloadingId(item.id)
    try {
      const blob = await getAttachmentContent(item.id)
      if (!blob) throw new Error('Dokumen tidak dapat diunduh.')
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = item.fileName
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Dokumen tidak dapat diunduh.', 'error')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <section className="card p-5">
      <h2 className="font-semibold">Dokumen</h2>
      {attachments === null ? (
        <p className="mt-2 text-sm text-slate-400">Memuat dokumen…</p>
      ) : loadError ? (
        <p className="mt-2 text-sm text-rose-600" role="alert">
          {loadError}
        </p>
      ) : visible.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">Belum ada dokumen yang diunggah.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {visible.map((item) => {
            const Icon = item.mimeType === 'application/pdf' ? FileText : FileSpreadsheet
            return (
              <li key={item.id} className="flex items-center gap-3 py-2.5">
                <Icon size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800" title={item.fileName}>
                    {item.fileName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {jobDocumentKindLabels[item.kind!]} · {formatSize(item.fileSize)} · {date(item.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void download(item)}
                  disabled={downloadingId === item.id}
                  className="btn-secondary shrink-0 gap-2 !px-3 !py-1.5"
                >
                  {downloadingId === item.id ? (
                    <Loader2 className="animate-spin" size={16} aria-hidden="true" />
                  ) : (
                    <Download size={16} aria-hidden="true" />
                  )}
                  Unduh
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
