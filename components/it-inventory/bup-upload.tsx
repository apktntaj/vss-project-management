'use client'

import { useRef, useState } from 'react'
import { FileSpreadsheet, Loader2, Upload, X } from 'lucide-react'

import { toast } from '@/components/toast'
import { bupDocumentLabels, type BupDocument } from '@/domain/it-inventory/types'

type BupUploadProps = {
  documents: BupDocument[]
  onAdd: (document: BupDocument) => void
  onRemove: (fileName: string) => void
}

/**
 * Unggah export BUP (BC 2.3 / BC 2.5 / BC 3.0). Setiap file di-parse server menjadi satu
 * transaksi buku arus barang; hasilnya hanya hidup di sesi (demo tanpa penyimpanan).
 */
export function BupUpload({ documents, onAdd, onRemove }: BupUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        const response = await fetch('/api/it-inventory/import', { method: 'POST', body: formData })
        const body = (await response.json().catch(() => null)) as BupDocument | { error?: string } | null
        if (!response.ok || !body || !('documentCode' in body)) {
          toast(
            (body && 'error' in body && body.error) || `File ${file.name} gagal dibaca.`,
            'error',
          )
          continue
        }
        onAdd(body)
        toast(
          `${bupDocumentLabels[body.documentCode]}${body.nomorDaftar ? ` no. daftar ${body.nomorDaftar}` : ''} tercatat: ${body.items.length} baris barang.`,
          'success',
        )
      }
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <section className="card p-5" aria-labelledby="it-inventory-upload-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="it-inventory-upload-title" className="text-lg font-semibold">
            Unggah dokumen pabean
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Export BUP (.xlsx) BC 2.3, BC 2.5, atau BC 3.0 — setiap baris barang otomatis
            menjadi transaksi di buku.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          multiple
          className="hidden"
          onChange={(event) => void handleFiles(event.target.files)}
        />
        <button
          type="button"
          className="btn-primary inline-flex items-center gap-2"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
          {busy ? 'Membaca file…' : 'Pilih file BUP'}
        </button>
      </div>
      {documents.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {documents.map((doc) => (
            <li
              key={doc.fileName}
              className="flex items-center gap-2 rounded-full border bg-slate-50 px-3 py-1.5 text-sm text-slate-700"
            >
              <FileSpreadsheet size={14} className="shrink-0 text-emerald-700" aria-hidden="true" />
              <span className="font-semibold">{bupDocumentLabels[doc.documentCode]}</span>
              <span className="text-slate-500">
                {doc.nomorDaftar ? `no. daftar ${doc.nomorDaftar}` : doc.fileName}
              </span>
              <button
                type="button"
                onClick={() => onRemove(doc.fileName)}
                aria-label={`Hapus ${doc.fileName} dari buku`}
                className="text-slate-400 hover:text-rose-600"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
