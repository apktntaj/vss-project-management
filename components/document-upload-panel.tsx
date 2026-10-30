'use client'

import { useRef, useState, type FormEvent } from 'react'
import { Upload } from 'lucide-react'
import { toast } from '@/components/toast'
import { ConfidenceBadge } from '@/components/confidence-badge'
import {
  extractDocument,
  uploadSupportingDocument,
  type DocumentOwner,
  type ExtractionOutcome,
} from '@/lib/data-client'
import type { ExtractionResult } from '@/domain/exhibition/source-documents'

type IntendedKind = 'CIPL' | 'TRANSPORT' | 'SUPPORTING'

const KIND_LABEL: Record<IntendedKind, string> = {
  CIPL: 'CIPL',
  TRANSPORT: 'B/L atau AWB',
  SUPPORTING: 'Dokumen pendukung',
}

type UploadPanelProps = {
  title: string
  description?: string
  owner: DocumentOwner
  intendedKinds: IntendedKind[]
  onExtracted?: (outcome: ExtractionOutcome) => void
  onUploaded?: (attachmentId: string) => void
}

export function DocumentUploadPanel({ title, description, owner, intendedKinds, onExtracted, onUploaded }: UploadPanelProps) {
  const [intendedKind, setIntendedKind] = useState<IntendedKind>(intendedKinds[0])
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [lastResult, setLastResult] = useState<ExtractionResult | null>(null)
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
      if (intendedKind === 'SUPPORTING') {
        const { attachmentId } = await uploadSupportingDocument({ ...owner, label: label.trim() || undefined, file })
        toast('Dokumen pendukung tersimpan.', 'success')
        fileInput.current!.value = ''
        onUploaded?.(attachmentId)
        return
      }
      const outcome = await extractDocument({ ...owner, intendedKind: intendedKind as 'CIPL' | 'TRANSPORT', file })
      setLastResult(outcome.result)
      toast('Dokumen diekstrak. Periksa dan koreksi hasilnya sebelum menyimpan.', 'success')
      fileInput.current!.value = ''
      onExtracted?.(outcome)
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Dokumen tidak dapat diekstrak.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border p-4">
      <h3 className="font-semibold">{title}</h3>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {intendedKinds.length > 1 && (
          <label className="label block">
            Jenis dokumen
            <select
              aria-label="Jenis dokumen yang diunggah"
              value={intendedKind}
              onChange={(event) => setIntendedKind(event.target.value as IntendedKind)}
              className="input mt-1"
            >
              {intendedKinds.map((kind) => (
                <option key={kind} value={kind}>{KIND_LABEL[kind]}</option>
              ))}
            </select>
          </label>
        )}
        {intendedKind === 'SUPPORTING' && (
          <label className="label block">
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
        )}
        <label className="label block">
          File PDF atau Excel (maks 10 MB)
          <input
            aria-label="File dokumen"
            ref={fileInput}
            type="file"
            accept="application/pdf,.pdf,.xlsx,.xls,.xlsm,.xlsb,.xltx,.xltm,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="mt-1 block w-full text-sm"
          />
        </label>
      </div>
      <button type="submit" disabled={busy} className="btn-primary mt-3" aria-label={`${busy ? 'Memproses' : 'Unggah'} ${title}`}>
        <Upload size={16} /> {busy ? 'Memproses...' : 'Unggah dan proses'}
      </button>
      {lastResult && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          Terdeteksi: <strong>{CLASSIFICATION_LABEL[lastResult.classification.documentType] ?? lastResult.classification.documentType}</strong>
          <ConfidenceBadge band={lastResult.band} score={lastResult.aggregateConfidence} />
          {lastResult.classification.needsUserConfirmation && (
            <span className="text-xs text-rose-600">Jenis dokumen perlu Anda konfirmasi.</span>
          )}
        </p>
      )}
    </form>
  )
}

export const CLASSIFICATION_LABEL: Record<string, string> = {
  CIPL_COMBINED: 'CIPL gabungan',
  PACKING_LIST: 'Packing list',
  COMMERCIAL_INVOICE: 'Commercial invoice',
  BILL_OF_LADING: 'Bill of lading',
  AIR_WAYBILL: 'Air waybill',
  SUPPORTING_DOCUMENT: 'Dokumen pendukung',
  UNREADABLE: 'Tidak dapat dibaca',
}
