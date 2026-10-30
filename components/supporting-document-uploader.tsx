'use client'

import { useRef, useState, type FormEvent } from 'react'
import { Paperclip } from 'lucide-react'
import { toast } from '@/components/toast'
import { uploadSupportingDocument, type DocumentOwner } from '@/lib/data-client'

/** Unggah dokumen pendukung dengan label teks bebas — tanpa daftar jenis tertutup (R1.11). */
export function SupportingDocumentUploader({
  owner,
  onUploaded,
}: {
  owner: DocumentOwner
  onUploaded: (attachmentId: string) => void
}) {
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const file = fileInput.current?.files?.[0]
    if (!file) {
      toast('File dokumen wajib diunggah.', 'error')
      return
    }
    setBusy(true)
    try {
      const { attachmentId } = await uploadSupportingDocument({ ...owner, label: label.trim() || undefined, file })
      toast('Dokumen pendukung tersimpan.', 'success')
      setLabel('')
      if (fileInput.current) fileInput.current.value = ''
      onUploaded(attachmentId)
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Dokumen tidak dapat diunggah.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <label className="label">
        Label (opsional)
        <input
          aria-label="Label dokumen pendukung"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          maxLength={120}
          placeholder="mis. surat kuasa, sertifikat"
          className="input mt-1"
        />
      </label>
      <label className="label">
        File PDF atau Excel
        <input
          aria-label="File dokumen pendukung"
          ref={fileInput}
          type="file"
          accept="application/pdf,.pdf,.xlsx,.xls,.xlsm,.xlsb,.xltx,.xltm,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="mt-1 block w-full text-sm"
        />
      </label>
      <button type="submit" disabled={busy} className="btn-secondary" aria-label="Unggah dokumen pendukung">
        <Paperclip size={16} /> {busy ? 'Mengunggah...' : 'Unggah'}
      </button>
    </form>
  )
}
