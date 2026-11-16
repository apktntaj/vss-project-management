'use client'

// Mengapa: leaf KLIEN tampilan baca surat penunjukan EO (nama file, klik untuk unduh) — dipakai
// tabel event, detail event, dan form edit. Unggah/ganti/hapus hanya lewat form edit event.

import { useState } from 'react'
import { FileText } from 'lucide-react'

import { toast } from '@/components/toast'
import { getAttachmentContent } from '@/lib/data-client'
import type { EventAppointmentLetter } from '@/domain/event/appointment-letter'

/** Nama file surat penunjukan; klik mengunduh isi file. */
export function EventAppointmentLetterLink({
  letter,
  className = '',
}: {
  letter: EventAppointmentLetter
  className?: string
}) {
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    setDownloading(true)
    try {
      const blob = await getAttachmentContent(letter.attachmentId)
      if (!blob) throw new Error('Surat penunjukan tidak dapat diunduh.')
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = letter.fileName
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Surat penunjukan tidak dapat diunduh.', 'error')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleDownload()}
      disabled={downloading}
      title={`Unduh ${letter.fileName}`}
      className={`flex min-w-0 items-center gap-1.5 rounded-md px-1 py-1 text-left font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 ${className}`}
    >
      <FileText size={14} className="shrink-0 text-emerald-600" aria-hidden="true" />
      <span className="truncate">{downloading ? 'Mengunduh…' : letter.fileName}</span>
    </button>
  )
}
