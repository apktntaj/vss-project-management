'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { FileText, FilePlus2, Loader2, Ship, X } from 'lucide-react'
import { saveJobDocument, type LocalJob, type LocalJobDocument } from '@/lib/data-client'
import type { JobInvoiceExtraction, JobTransportExtraction } from '@/domain/exhibition/source-documents'
import type { DocumentClassification, JobDocumentExtraction } from '@/components/job-row'
import { isAcceptedJobDocument, jobDocumentAccept } from '@/components/job-document-file'
import { compareInvoiceWithTransport } from '@/lib/document-comparison'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type ZoneKey = 'CIPL' | 'TRANSPORT' | 'SUPPORTING'

const TRANSPORT_TYPES = ['BILL_OF_LADING', 'AIR_WAYBILL']

const ZONES: Array<{ key: ZoneKey; title: string; description: string }> = [
  {
    key: 'CIPL',
    title: 'CIPL',
    description: 'CIPL atau dua dokumen Packing List dan Invoice.',
  },
  {
    key: 'TRANSPORT',
    title: 'B/L atau AWB',
    description: 'Bill of lading atau Airway Bill.',
  },
  {
    key: 'SUPPORTING',
    title: 'Dokumen pendukung lainnya',
    description: 'Opsional — dokumen lampiran.',
  },
]

const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  BILL_OF_LADING: 'Bill of Lading',
  AIR_WAYBILL: 'Air Waybill',
  COMMERCIAL_INVOICE: 'Commercial Invoice',
  OTHER: 'dokumen lain',
  UNREADABLE: 'tidak terbaca',
}

const EMPTY_ZONES: Record<ZoneKey, File[]> = { CIPL: [], TRANSPORT: [], SUPPORTING: [] }

const ZONE_ICON: Record<ZoneKey, typeof FileText> = {
  CIPL: FileText,
  TRANSPORT: Ship,
  SUPPORTING: FilePlus2,
}

/** Dialog unggah dokumen job dengan tiga zona eksplisit; tiap zona CIPL/transport tetap diperiksa AI. */
export function JobUploadDialog({
  job,
  open,
  onOpenChange,
  onDocumentUploaded,
  onToast,
}: {
  job: LocalJob
  open: boolean
  onOpenChange: (open: boolean) => void
  onDocumentUploaded: (
    jobId: string,
    document: LocalJobDocument,
    extraction?: JobDocumentExtraction,
  ) => void
  onToast: (message: string, tone?: 'info' | 'error') => void
}) {
  const [zoneFiles, setZoneFiles] = useState<Record<ZoneKey, File[]>>(EMPTY_ZONES)
  const [busy, setBusy] = useState(false)
  const inputRefs = useRef<Partial<Record<ZoneKey, HTMLInputElement | null>>>({})
  const total = Object.values(zoneFiles).reduce((sum, files) => sum + files.length, 0)

  // Daftar file disalin SEBELUM input dikosongkan (mengosongkan value menghapus FileList),
  // dan pemilihan berikutnya menambah — bukan menggantikan.
  const setZone = (key: ZoneKey, event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length) setZoneFiles((current) => ({ ...current, [key]: [...current[key], ...files] }))
  }

  const removeFile = (key: ZoneKey, index: number) =>
    setZoneFiles((current) => ({ ...current, [key]: current[key].filter((_, position) => position !== index) }))

  // Saat unggahan berjalan dialog terkunci: klik di luar, tombol tutup, dan Escape diabaikan.
  const requestClose = (open: boolean) => {
    if (!open && busy) return
    onOpenChange(open)
  }

  async function classifyFile(file: File): Promise<JobDocumentExtraction & { classification: DocumentClassification }> {
    const formData = new FormData()
    formData.set('file', file)
    const response = await fetch('/api/classify-job-document', { method: 'POST', body: formData })
    const payload = (await response.json().catch(() => null)) as
      | ({ classification?: DocumentClassification; error?: string } & JobDocumentExtraction)
      | null
    const classification = payload?.classification
    if (!response.ok || !classification) {
      throw new Error(payload?.error || 'Dokumen tidak dapat diperiksa.')
    }
    return { ...payload, classification }
  }

  function mismatchMessage(zone: ZoneKey, documentType: string): string | null {
    if (documentType === 'UNREADABLE' || documentType === 'OTHER') return null
    if (zone === 'CIPL' && TRANSPORT_TYPES.includes(documentType)) {
      return `terdeteksi ${DOCUMENT_TYPE_LABEL[documentType] ?? documentType}, bukan dokumen CIPL`
    }
    if (zone === 'TRANSPORT' && !TRANSPORT_TYPES.includes(documentType)) {
      return `terdeteksi ${DOCUMENT_TYPE_LABEL[documentType] ?? documentType}, bukan B/L atau AWB`
    }
    return null
  }

  async function submit() {
    if (!total || busy) return
    const rejected = Object.values(zoneFiles).flat().filter((file) => !isAcceptedJobDocument(file))
    if (rejected.length) {
      onToast(`${rejected.length} file dilewati — harus PDF atau Excel (.xls, .xlsx, .xlsm, .xlsb, .xltx, .xltm).`, 'error')
    }
    setBusy(true)
    let uploaded = 0
    let failed = 0
    let withoutAi = 0
    const warnings: string[] = []
    let invoice: JobInvoiceExtraction | null = null
    let transport: JobTransportExtraction | null = null
    try {
      for (const zone of ZONES) {
        for (const file of zoneFiles[zone.key].filter(isAcceptedJobDocument)) {
          try {
            if (zone.key === 'SUPPORTING') {
              const document = await saveJobDocument(job.id, file, 'OTHER')
              onDocumentUploaded(job.id, document)
              uploaded += 1
              withoutAi += 1
              continue
            }
            const payload = await classifyFile(file)
            const documentType = payload.classification.documentType
            const kind = documentType === 'UNREADABLE' ? 'OTHER' : documentType
            const document = await saveJobDocument(job.id, file, kind, payload.invoice, payload.transport)
            onDocumentUploaded(job.id, document, { invoice: payload.invoice, transport: payload.transport })
            uploaded += 1
            if (payload.invoice) invoice = payload.invoice
            if (payload.transport) transport = payload.transport
            const mismatch = mismatchMessage(zone.key, documentType)
            if (mismatch) warnings.push(`${file.name} ${mismatch}`)
          } catch (caught) {
            const reason = caught instanceof Error ? caught.message : 'dokumen tidak dapat diperiksa'
            try {
              const document = await saveJobDocument(job.id, file, 'OTHER')
              onDocumentUploaded(job.id, document)
              uploaded += 1
              withoutAi += 1
              warnings.push(`${file.name}: ${reason}`)
            } catch {
              failed += 1
            }
          }
        }
      }
      const parts: string[] = []
      parts.push(
        failed
          ? `${uploaded}/${total} dokumen terunggah — ${failed} gagal, coba unggah ulang`
          : `${uploaded} dokumen terunggah`,
      )
      if (withoutAi) parts.push(`${withoutAi} tanpa pemeriksaan AI`)
      parts.push(...warnings)
      const differences =
        invoice && transport
          ? compareInvoiceWithTransport(invoice, transport)
              .filter((item) => item.status === 'DIFFERENT')
              .map((item) => item.label)
          : []
      if (differences.length) {
        parts.push(`Perlu cek: ${differences.join(', ')} berbeda antara Invoice dan B/L/AWB`)
      } else if (invoice && transport) {
        parts.push('Data Invoice dan B/L/AWB konsisten')
      }
      onToast(parts.join(' · '), failed || warnings.length || differences.length ? 'error' : 'info')
      if (uploaded > 0) {
        setZoneFiles(EMPTY_ZONES)
        onOpenChange(false)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Unggah Dokumen Job</DialogTitle>
          <DialogDescription>
            Unggah sesuai jenis dokumen.
          </DialogDescription>
        </DialogHeader>
        {busy ? (
          <div className="space-y-3" aria-busy="true">
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 size={14} className="animate-spin" /> Memeriksa dokumen dengan AI...
            </p>
            {ZONES.map((zone) => (
              <Skeleton key={zone.key} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {ZONES.map((zone) => {
              const files = zoneFiles[zone.key]
              const Icon = ZONE_ICON[zone.key]
              return (
                <div key={zone.key} className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Icon size={15} className="shrink-0 text-slate-400" />
                    <p className="text-sm font-medium text-slate-700">{zone.title}</p>
                    {files.length > 0 && (
                      <span className="ml-auto rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                        {files.length} file dipilih
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{zone.description}</p>
                  <input
                    ref={(element) => {
                      inputRefs.current[zone.key] = element
                    }}
                    type="file"
                    multiple
                    accept={jobDocumentAccept}
                    onChange={(event) => setZone(zone.key, event)}
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                  {files.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => inputRefs.current[zone.key]?.click()}
                      aria-label={`Pilih file ${zone.title}`}
                      className="btn-secondary mt-2"
                    >
                      Pilih file...
                    </button>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {files.map((file, index) => (
                        <li
                          key={`${file.name}-${index}`}
                          className="flex items-center gap-2 rounded-md bg-orange-50 px-2.5 py-1.5 text-sm text-orange-800 ring-1 ring-inset ring-orange-200"
                        >
                          <FileText size={13} className="shrink-0" />
                          <span className="min-w-0 flex-1 truncate" title={file.name}>{file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeFile(zone.key, index)}
                            aria-label={`Hapus file ${file.name}`}
                            className="shrink-0 rounded p-0.5 text-orange-500 hover:bg-orange-100 hover:text-orange-700"
                          >
                            <X size={13} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => requestClose(false)} disabled={busy}>
            Batal
          </Button>
          <Button type="button" onClick={submit} disabled={busy || total === 0}>
            {busy ? 'Mengunggah...' : `Unggah ${total || ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
