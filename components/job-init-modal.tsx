'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Pencil, Plus, Upload, X } from 'lucide-react'

import {
  createInternationalJobInit,
  createLocalJobInit,
  deleteJob,
  listAgents,
  saveAgent,
  saveJobDocument,
  type Agent,
  type InternationalJobJenis,
  type JobDocumentKind,
  type LocalEvent,
  type LocalJob,
} from '@/lib/data-client'
import { internationalJobJenisLabels } from '@/domain/job/types'
import type {
  ConfidenceBand,
  JobInvoiceExtraction,
  JobTransportExtraction,
} from '@/domain/exhibition/source-documents'
import { ConfidenceBadge } from '@/components/confidence-badge'
import { InvoiceEditor, TransportEditor } from '@/components/job-document-editor-dialog'
import { isAcceptedJobDocument, jobDocumentAccept } from '@/components/job-document-file'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

function toast(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('vss:toast', { detail: { message, tone } }))
}

type JobTypeSelection = 'LOCAL' | InternationalJobJenis

const jobTypeOptions: Array<{ value: JobTypeSelection; description: string }> = [
  {
    value: 'TPPB_BC_23',
    description:
      'Fasilitas Tempat Penyelenggaraan Pameran Berikat; barang masuk venue berikat via BC 2.3.',
  },
  {
    value: 'ATA_CARNET',
    description: 'Impor sementara dengan paspor barang ATA Carnet.',
  },
  {
    value: 'TEMPORARY_IMPORT',
    description: 'Impor sementara biasa dengan jaminan; barang wajib keluar kembali.',
  },
  {
    value: 'PERMANENT_IMPORT',
    description: 'Impor tetap (Genco); barang tetap berada di Indonesia.',
  },
  {
    value: 'ROAD_SHIPMENT',
    description: 'Pengangkutan darat / pengalihan barang antar tempat (BC 2.7).',
  },
  {
    value: 'LOCAL',
    description: 'Barang pihak lokal tanpa dokumen kepabeanan.',
  },
]

function jobTypeLabel(value: JobTypeSelection) {
  return value === 'LOCAL' ? 'Local' : internationalJobJenisLabels[value]
}

const detailTypeLabels: Record<string, string> = {
  CIPL_COMBINED: 'CIPL (invoice + packing list)',
  PACKING_LIST: 'Packing list',
  COMMERCIAL_INVOICE: 'Commercial invoice',
  BILL_OF_LADING: 'Bill of lading',
  AIR_WAYBILL: 'Air waybill',
  SUPPORTING_DOCUMENT: 'Dokumen pendukung',
  UNREADABLE: 'Tidak terbaca',
}

const kindOptions: Array<{ value: JobDocumentKind; label: string }> = [
  { value: 'BILL_OF_LADING', label: 'B/L (laut)' },
  { value: 'AIR_WAYBILL', label: 'AWB (udara)' },
  { value: 'COMMERCIAL_INVOICE', label: 'Invoice / CIPL' },
  { value: 'OTHER', label: 'Pendukung / lainnya' },
]

function kindFromDocumentType(documentType: string | null): JobDocumentKind {
  if (documentType === 'BILL_OF_LADING') return 'BILL_OF_LADING'
  if (documentType === 'AIR_WAYBILL') return 'AIR_WAYBILL'
  if (documentType === 'CIPL_COMBINED' || documentType === 'COMMERCIAL_INVOICE') {
    return 'COMMERCIAL_INVOICE'
  }
  return 'OTHER'
}

type ReviewItem = {
  file: File
  status: 'queued' | 'processing' | 'done'
  kind: JobDocumentKind
  detailType: string | null
  method: 'LLM' | 'DETERMINISTIC' | null
  aggregateConfidence: number | null
  band: ConfidenceBand | null
  fieldConfidence: Record<string, number>
  invoice: JobInvoiceExtraction | null
  transport: JobTransportExtraction | null
  editedPaths: string[]
  error: string | null
}

type ClassifyResponse = {
  classification?: { documentType?: string; confidence?: number }
  invoice?: JobInvoiceExtraction | null
  transport?: JobTransportExtraction | null
  detail?: {
    method: 'LLM' | 'DETERMINISTIC'
    documentType: string
    confidence: number
    needsUserConfirmation: boolean
    rationale: string | null
    fieldConfidence: Record<string, number>
    aggregateConfidence: number
    band: ConfidenceBand
  } | null
  error?: string
}

function flattenLeaves(value: unknown, prefix: string, out: Record<string, unknown>) {
  if (value === null || value === undefined || typeof value !== 'object') {
    out[prefix] = value
    return
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => flattenLeaves(entry, `${prefix}.${index}`, out))
    return
  }
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    flattenLeaves(entry, `${prefix}.${key}`, out)
  }
}

/** Dot-path yang nilainya berubah setelah user mengedit — dipandu sebagai sudah diperiksa. */
function changedPaths(before: unknown, after: unknown, prefix: string): string[] {
  const previous: Record<string, unknown> = {}
  const next: Record<string, unknown> = {}
  flattenLeaves(before, prefix, previous)
  flattenLeaves(after, prefix, next)
  return Object.keys({ ...previous, ...next }).filter((key) => previous[key] !== next[key])
}

/**
 * Inisiasi job dalam satu form: jenis job (dropdown, default TPPB) + agent opsional.
 * Setelah job draft dibuat, dokumen diperiksa AI dan hasilnya wajib dikonfirmasi
 * user sebelum dialog ditutup; membatalkan menghapus job draft.
 */
export function JobInitModal({
  event,
  onCreated,
  onCancel,
}: {
  event: LocalEvent
  onCreated: (job: LocalJob) => void
  onCancel: () => void
}) {
  const [selection, setSelection] = useState<JobTypeSelection>('TPPB_BC_23')
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [tanpaAgent, setTanpaAgent] = useState(false)
  const [creatingNew, setCreatingNew] = useState(false)
  const [agentQuery, setAgentQuery] = useState('')
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [newAgentName, setNewAgentName] = useState('')
  const [newAgentContactName, setNewAgentContactName] = useState('')
  const [newAgentEmail, setNewAgentEmail] = useState('')
  const [newAgentPhone, setNewAgentPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [phase, setPhase] = useState<'form' | 'review'>('form')
  const [jobDraft, setJobDraft] = useState<LocalJob | null>(null)
  const [agentLabel, setAgentLabel] = useState('')
  const [items, setItems] = useState<ReviewItem[]>([])
  const [classifying, setClassifying] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [editor, setEditor] = useState<{ index: number; side: 'INVOICE' | 'TRANSPORT' } | null>(null)
  const [editorInvoice, setEditorInvoice] = useState<JobInvoiceExtraction | null>(null)
  const [editorTransport, setEditorTransport] = useState<JobTransportExtraction | null>(null)
  const classifyAbortRef = useRef<AbortController | null>(null)

  function addFiles(fileList: FileList | null) {
    const incoming = Array.from(fileList ?? [])
    if (!incoming.length) return
    const accepted = incoming.filter(isAcceptedJobDocument)
    if (accepted.length !== incoming.length) {
      toast('File harus berupa PDF atau Excel.', 'error')
    }
    if (accepted.length) setFiles((current) => [...current, ...accepted])
  }

  async function classifyOne(file: File, signal: AbortSignal): Promise<Partial<ReviewItem>> {
    try {
      const formData = new FormData()
      formData.set('file', file)
      const response = await fetch('/api/classify-job-document', {
        method: 'POST',
        body: formData,
        signal,
      })
      const payload = (await response.json().catch(() => null)) as ClassifyResponse | null
      if (!response.ok || !payload || !payload.classification) {
        throw new Error(payload?.error || 'Dokumen tidak dapat diperiksa.')
      }
      const detail = payload.detail ?? null
      return {
        status: 'done',
        kind: kindFromDocumentType(detail?.documentType ?? payload.classification.documentType ?? null),
        detailType: detail?.documentType ?? null,
        method: detail?.method ?? null,
        aggregateConfidence: detail ? detail.aggregateConfidence : (payload.classification.confidence ?? null),
        band: detail?.band ?? null,
        fieldConfidence: detail?.fieldConfidence ?? {},
        invoice: payload.invoice ?? null,
        transport: payload.transport ?? null,
        error: null,
      }
    } catch (caught) {
      if (signal.aborted) return {}
      return {
        status: 'done',
        error: caught instanceof Error ? caught.message : 'Dokumen tidak dapat diperiksa AI.',
      }
    }
  }

  async function runClassification(pending: ReviewItem[]) {
    const controller = new AbortController()
    classifyAbortRef.current = controller
    setClassifying(true)
    try {
      for (let index = 0; index < pending.length; index++) {
        if (controller.signal.aborted) return
        setItems((current) =>
          current.map((item, i) => (i === index ? { ...item, status: 'processing' } : item)),
        )
        const outcome = await classifyOne(pending[index].file, controller.signal)
        if (controller.signal.aborted) return
        setItems((current) =>
          current.map((item, i) => (i === index ? { ...item, ...outcome } : item)),
        )
      }
    } finally {
      if (classifyAbortRef.current === controller) classifyAbortRef.current = null
      setClassifying(false)
    }
  }

  useEffect(() => {
    let active = true
    listAgents().then((loadedAgents) => {
      if (!active) return
      setAgents(loadedAgents)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    return () => {
      classifyAbortRef.current?.abort()
    }
  }, [])

  function changeSelection(next: JobTypeSelection) {
    setSelection(next)
    // Local tidak membutuhkan agent — centang "Tanpa agent" secara bawaan.
    setTanpaAgent(next === 'LOCAL')
  }

  const agentSuggestions = useMemo(() => {
    const query = agentQuery.trim().toLowerCase()
    if (!query) return []
    return agents.filter((agent) => agent.name.toLowerCase().includes(query)).slice(0, 6)
  }, [agentQuery, agents])

  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    setSaving(true)
    setError('')
    try {
      // Agent opsional penuh: satu-satunya syarat submit adalah jenis job terpilih.
      // Pilihan kosong / nama agent baru kosong → job dibuat tanpa agent.
      let agentId: string | null = null
      let agentName = ''
      if (!tanpaAgent) {
        if (creatingNew && newAgentName.trim()) {
          const created = await saveAgent({
            name: newAgentName,
            contact: {
              name: newAgentContactName || null,
              role: null,
              email: newAgentEmail || null,
              phone: newAgentPhone || null,
            },
            address: null,
            countryCode: null,
          })
          agentId = created.id
          agentName = created.name
        } else if (selectedAgentId) {
          agentId = selectedAgentId
          agentName = agents.find((agent) => agent.id === agentId)?.name ?? ''
        }
      }
      const job =
        selection === 'LOCAL'
          ? await createLocalJobInit(event.id, agentId)
          : await createInternationalJobInit({
              eventId: event.id,
              agentId,
              internationalJenis: selection,
            })
      if (!files.length) {
        toast(
          agentName
            ? `Job (${jobTypeLabel(selection)}) dibuat untuk agent ${agentName}.`
            : `Job (${jobTypeLabel(selection)}) dibuat.`,
          'success',
        )
        onCreated(job)
        return
      }
      setAgentLabel(agentName)
      setJobDraft(job)
      const pending: ReviewItem[] = files.map((file) => ({
        file,
        status: 'queued',
        kind: 'OTHER',
        detailType: null,
        method: null,
        aggregateConfidence: null,
        band: null,
        fieldConfidence: {},
        invoice: null,
        transport: null,
        editedPaths: [],
        error: null,
      }))
      setItems(pending)
      setPhase('review')
      await runClassification(pending)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Job tidak dapat dibuat.'
      setError(message)
      toast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function confirmReview() {
    if (!jobDraft) return
    setFinishing(true)
    let examined = 0
    let failed = 0
    for (const item of items) {
      try {
        if (item.error) {
          await saveJobDocument(jobDraft.id, item.file, 'OTHER')
        } else {
          examined += 1
          await saveJobDocument(jobDraft.id, item.file, item.kind, item.invoice, item.transport)
        }
      } catch {
        failed += 1
      }
    }
    if (items.length) {
      if (failed === 0 && examined === items.length) {
        toast(`${items.length} dokumen dikonfirmasi dan tersimpan.`, 'success')
      } else if (failed === 0) {
        toast(
          `${examined}/${items.length} dokumen tersimpan — sisanya tersimpan tanpa klasifikasi dan bisa diperiksa ulang di detail job.`,
          'success',
        )
      } else {
        toast(
          `${items.length - failed}/${items.length} dokumen tersimpan — ${failed} gagal dan bisa diunggah ulang di detail job.`,
          'error',
        )
      }
    }
    toast(
      agentLabel
        ? `Job (${jobTypeLabel(selection)}) dibuat untuk agent ${agentLabel}.`
        : `Job (${jobTypeLabel(selection)}) dibuat.`,
      'success',
    )
    onCreated(jobDraft)
  }

  async function cancelAndDelete() {
    if (!jobDraft) return
    setDeleting(true)
    classifyAbortRef.current?.abort()
    try {
      await deleteJob(jobDraft.id)
      toast('Pembuatan job dibatalkan.', 'success')
      onCancel()
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Job tidak dapat dihapus.', 'error')
      setDeleting(false)
      setConfirmCancel(false)
    }
  }

  function requestClose() {
    if (finishing || deleting) return
    if (phase === 'review') setConfirmCancel(true)
    else onCancel()
  }

  function openEditor(index: number, side: 'INVOICE' | 'TRANSPORT') {
    const item = items[index]
    if (!item) return
    if (side === 'INVOICE' && item.invoice) setEditorInvoice(item.invoice)
    if (side === 'TRANSPORT' && item.transport) setEditorTransport(item.transport)
    setEditor({ index, side })
  }

  function applyEditor(editEvent: FormEvent<HTMLFormElement>) {
    editEvent.preventDefault()
    if (!editor) return
    const { index, side } = editor
    if (side === 'INVOICE' && !editorInvoice) return
    if (side === 'TRANSPORT' && !editorTransport) return
    setItems((current) =>
      current.map((item, i) => {
        if (i !== index) return item
        if (side === 'INVOICE') {
          return {
            ...item,
            invoice: editorInvoice,
            editedPaths: Array.from(
              new Set([...item.editedPaths, ...changedPaths(item.invoice, editorInvoice, 'invoice')]),
            ),
          }
        }
        return {
          ...item,
          transport: editorTransport,
          editedPaths: Array.from(
            new Set([...item.editedPaths, ...changedPaths(item.transport, editorTransport, 'transport')]),
          ),
        }
      }),
    )
    setEditor(null)
  }

  const classifiedCount = items.filter((item) => item.status === 'done').length
  const inReview = phase === 'review'

  function transportRows(item: ReviewItem) {
    const transport = item.transport
    if (!transport) return []
    const name = (party: { name: string | null } | null) => party?.name ?? null
    const packages =
      transport.packageCount == null
        ? null
        : `${transport.packageCount}${transport.packageType ? ` ${transport.packageType}` : ''}`
    const containers = transport.containers.length
      ? `${transport.containers.length} kontainer: ${transport.containers
          .map((container) =>
            [container.containerNumber, container.size].filter(Boolean).join(' '),
          )
          .join(', ')}`
      : null
    return [
      { label: 'No dokumen', value: transport.documentNumber, path: 'transport.documentNumber' },
      { label: 'Carrier', value: transport.carrier, path: 'transport.carrier' },
      { label: 'Kapal / flight', value: transport.vesselOrFlight, path: 'transport.vesselOrFlight' },
      { label: 'Voyage / flight', value: transport.voyageOrFlightNumber, path: 'transport.voyageOrFlightNumber' },
      { label: 'Shipper', value: name(transport.shipper), path: 'transport.shipper.name' },
      { label: 'Consignee', value: name(transport.consignee), path: 'transport.consignee.name' },
      { label: 'Notify party', value: name(transport.notifyParty), path: 'transport.notifyParty.name' },
      { label: 'Pelabuhan muat', value: transport.portOfLoading, path: 'transport.portOfLoading' },
      { label: 'Pelabuhan bongkar', value: transport.portOfDischarge, path: 'transport.portOfDischarge' },
      { label: 'ETD', value: transport.etd, path: 'transport.etd' },
      { label: 'ETA', value: transport.eta, path: 'transport.eta' },
      { label: 'Koli', value: packages, path: 'transport.packageCount' },
      { label: 'Bruto (kg)', value: transport.grossWeightKg, path: 'transport.grossWeightKg' },
      { label: 'Kontainer', value: containers, path: null },
    ]
  }

  function invoiceRows(item: ReviewItem) {
    const invoice = item.invoice
    if (!invoice) return []
    const total =
      invoice.totalAmount == null
        ? null
        : `${invoice.currency ?? ''} ${invoice.totalAmount.toLocaleString('id-ID')}`.trim()
    const incoterm = [invoice.incoterm, invoice.incotermLocation].filter(Boolean).join(' ')
    const packages =
      invoice.totalPackageCount == null
        ? null
        : `${invoice.totalPackageCount}${invoice.packageType ? ` ${invoice.packageType}` : ''}`
    return [
      { label: 'No invoice', value: invoice.invoiceNumber, path: 'invoice.invoiceNumber' },
      { label: 'Tanggal', value: invoice.invoiceDate, path: 'invoice.invoiceDate' },
      { label: 'Penjual', value: invoice.seller?.name ?? null, path: 'invoice.seller.name' },
      { label: 'Pembeli', value: invoice.buyer?.name ?? null, path: 'invoice.buyer.name' },
      { label: 'Total', value: total, path: 'invoice.totalAmount' },
      { label: 'Incoterm', value: incoterm || null, path: 'invoice.incoterm' },
      { label: 'Koli', value: packages, path: 'invoice.totalPackageCount' },
      { label: 'Bruto (kg)', value: invoice.totalGrossWeightKg, path: 'invoice.totalGrossWeightKg' },
      { label: 'Netto (kg)', value: invoice.totalNetWeightKg, path: 'invoice.totalNetWeightKg' },
      {
        label: 'Jumlah item',
        value: invoice.items.length ? String(invoice.items.length) : null,
        path: null,
      },
    ]
  }

  function cardRows(item: ReviewItem) {
    if (item.kind === 'BILL_OF_LADING' || item.kind === 'AIR_WAYBILL') return transportRows(item)
    if (item.invoice) return invoiceRows(item)
    return []
  }

  function editorSideFor(item: ReviewItem): 'INVOICE' | 'TRANSPORT' | null {
    if ((item.kind === 'BILL_OF_LADING' || item.kind === 'AIR_WAYBILL') && item.transport) {
      return 'TRANSPORT'
    }
    if (item.invoice) return 'INVOICE'
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      role="presentation"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) requestClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-init-title"
        className="card flex max-h-[calc(100vh-2rem)] min-h-0 w-full max-w-2xl flex-col overflow-hidden"
      >
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-5 sm:px-8">
          <div>
            <h2 id="job-init-title" className="text-2xl font-bold">
              {inReview ? 'Periksa dokumen' : 'Form Job Baru'}
            </h2>
            <h3 className="mt-1 text-sm text-slate-500">
              Untuk event: {event.officialName}
              {inReview ? ` · Jenis job: ${jobTypeLabel(selection)}` : ''}
            </h3>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Tutup form inisiasi job"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-black"
          >
            <X size={20} />
          </button>
        </div>

        {inReview ? (
          <>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6 sm:p-8">
              <p className="text-sm text-slate-500">
                {classifying
                  ? `Memeriksa dokumen dengan AI... (${classifiedCount}/${items.length})`
                  : 'Periksa hasil pemeriksaan AI di bawah. Koreksi lewat ikon pensil bila ada yang keliru, lalu konfirmasi.'}
              </p>
              <ul className="space-y-4">
                {items.map((item, index) => {
                  const rows = cardRows(item)
                  const side = editorSideFor(item)
                  const processing = item.status !== 'done'
                  return (
                    <li key={`${item.file.name}-${index}`} className="rounded-xl border border-black/10 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-700">
                            {item.file.name}
                            <span className="ml-2 text-xs font-normal text-slate-400">
                              {Math.max(1, Math.round(item.file.size / 1024))} KB
                            </span>
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            {item.band ? (
                              <ConfidenceBadge band={item.band} score={item.aggregateConfidence ?? undefined} />
                            ) : null}
                            {item.method === 'DETERMINISTIC' ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                                deterministik
                              </span>
                            ) : null}
                            {item.detailType && !item.error ? (
                              <span>{detailTypeLabels[item.detailType] ?? item.detailType}</span>
                            ) : null}
                            {item.error ? (
                              <span className="font-medium text-rose-700">Tidak dapat diperiksa AI</span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {!processing ? (
                            <>
                              <select
                                value={item.kind}
                                onChange={(selectEvent) =>
                                  setItems((current) =>
                                    current.map((entry, i) =>
                                      i === index
                                        ? { ...entry, kind: selectEvent.target.value as JobDocumentKind }
                                        : entry,
                                    ),
                                  )
                                }
                                aria-label={`Jenis dokumen ${item.file.name}`}
                                className="input max-w-44 py-1.5 text-xs"
                                disabled={finishing}
                              >
                                {kindOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              {side ? (
                                <button
                                  type="button"
                                  onClick={() => openEditor(index, side)}
                                  aria-label={`Edit isi ${item.file.name}`}
                                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-black"
                                  disabled={finishing}
                                >
                                  <Pencil size={15} aria-hidden="true" />
                                </button>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      </div>

                      {processing ? (
                        <div className="mt-3 space-y-2" aria-live="polite">
                          <p className="text-xs text-slate-400">
                            {item.status === 'processing'
                              ? `Memeriksa ${item.file.name} dengan AI...`
                              : 'Menunggu giliran...'}
                          </p>
                          <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
                          <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
                        </div>
                      ) : item.error ? (
                        <p className="mt-3 text-xs text-slate-500">
                          {item.error} Dokumen akan tersimpan tanpa klasifikasi; Anda bisa memeriksanya
                          ulang di detail job.
                        </p>
                      ) : rows.length ? (
                        <div className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                          {rows.map((row) => {
                            const edited = row.path ? item.editedPaths.includes(row.path) : false
                            const score = row.path ? item.fieldConfidence[row.path] : undefined
                            const text = row.value != null ? String(row.value).trim() : ''
                            const marker = edited
                              ? { text: 'dikoreksi', className: 'text-emerald-700' }
                              : !text
                                ? { text: 'belum terisi', className: 'text-amber-700' }
                                : typeof score === 'number' && score < 0.7
                                  ? {
                                      text: `${Math.round(score * 100)}% · perlu ditinjau`,
                                      className: 'text-amber-700',
                                    }
                                  : typeof score === 'number'
                                    ? { text: `${Math.round(score * 100)}%`, className: 'text-slate-400' }
                                    : null
                            return (
                              <div
                                key={row.label}
                                className="flex items-baseline justify-between gap-3 text-sm"
                              >
                                <span className="shrink-0 text-slate-500">{row.label}</span>
                                <span className="min-w-0 truncate text-right font-medium text-slate-600">
                                  {text || '—'}
                                  {marker ? (
                                    <span className={`ml-2 text-xs font-normal ${marker.className}`}>
                                      {marker.text}
                                    </span>
                                  ) : null}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-slate-500">
                          Tidak ada data {item.kind === 'OTHER' ? 'yang diekstraksi' : 'sesuai jenis ini'} —
                          dokumen tetap tersimpan.
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="shrink-0 border-t px-6 py-4 sm:px-8">
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmCancel(true)}
                  disabled={finishing || deleting}
                  className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Batalkan pembuatan job
                </button>
                <button
                  type="button"
                  onClick={confirmReview}
                  disabled={classifying || finishing}
                  className="btn-primary"
                >
                  {finishing ? 'Menyimpan...' : 'Konfirmasi & selesaikan'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6 sm:p-8">
              <label className="label">
                Jenis job
                <select
                  value={selection}
                  onChange={(selectEvent) =>
                    changeSelection(selectEvent.target.value as JobTypeSelection)
                  }
                  className="input mt-1"
                >
                  {jobTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {jobTypeLabel(option.value)}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  {jobTypeOptions.find((option) => option.value === selection)?.description}
                </span>
              </label>

              <section>
                {!creatingNew ? (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setCreatingNew(true)}
                      disabled={tanpaAgent}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 hover:text-orange-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus size={13} aria-hidden="true" />
                      Tambah agent
                    </button>
                  </div>
                ) : null}

                {!tanpaAgent && creatingNew ? (
                  <div className="mt-3">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="label sm:col-span-2">
                        Nama agent
                        <input
                          value={newAgentName}
                          onChange={(inputEvent) =>
                            setNewAgentName(inputEvent.target.value.toLocaleUpperCase('id-ID'))
                          }
                          className="input mt-1"
                          placeholder="cth. JS LOGISTICS"
                        />
                      </label>
                      <label className="label">
                        Nama PIC
                        <input
                          value={newAgentContactName}
                          onChange={(inputEvent) => setNewAgentContactName(inputEvent.target.value)}
                          className="input mt-1"
                        />
                      </label>
                      <label className="label">
                        Telepon PIC
                        <input
                          value={newAgentPhone}
                          onChange={(inputEvent) => setNewAgentPhone(inputEvent.target.value)}
                          className="input mt-1"
                        />
                      </label>
                      <label className="label sm:col-span-2">
                        Email PIC
                        <input
                          type="email"
                          value={newAgentEmail}
                          onChange={(inputEvent) => setNewAgentEmail(inputEvent.target.value)}
                          className="input mt-1"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCreatingNew(false)}
                      className="mt-3 text-xs font-semibold text-orange-700 hover:text-orange-800"
                    >
                      Pilih agent tersimpan
                    </button>
                  </div>
                ) : (
                  <div className="mt-3">
                    <div className="relative">
                      <input
                        value={agentQuery}
                        onChange={(inputEvent) => {
                          setAgentQuery(inputEvent.target.value)
                          setSelectedAgentId(null)
                        }}
                        className="input"
                        placeholder={loading ? 'Memuat agent...' : 'Ketik nama agent...'}
                        disabled={tanpaAgent}
                        aria-label="Cari agent"
                        autoComplete="off"
                      />
                      {agentSuggestions.length > 0 && !selectedAgentId ? (
                        <ul
                          className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-black/10 bg-white py-1 shadow-lg"
                          aria-label="Saran agent"
                        >
                          {agentSuggestions.map((agent) => (
                            <li key={agent.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedAgentId(agent.id)
                                  setAgentQuery(agent.name)
                                }}
                                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-orange-50"
                              >
                                {agent.name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    {selectedAgentId ? (
                      <p className="mt-1.5 text-xs font-medium text-emerald-700">
                        Agent terpilih: {agents.find((agent) => agent.id === selectedAgentId)?.name}
                      </p>
                    ) : null}
                  </div>
                )}

                <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={tanpaAgent}
                    onChange={(checkEvent) => setTanpaAgent(checkEvent.target.checked)}
                    className="h-4 w-4 accent-orange-600"
                  />
                  Tanpa agent
                </label>
              </section>

              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                  Dokumen <span className="font-normal normal-case tracking-normal">(opsional)</span>
                </h3>
                <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-black/20 px-4 py-3 text-sm text-slate-500 hover:border-orange-300 hover:bg-orange-50">
                  <span className="min-w-0 truncate">Unggah B/L, AWB, atau Invoice (PDF/Excel)</span>
                  <Upload size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
                  <input
                    type="file"
                    multiple
                    accept={jobDocumentAccept}
                    className="sr-only"
                    onChange={(inputEvent) => {
                      addFiles(inputEvent.target.files)
                      inputEvent.target.value = ''
                    }}
                  />
                </label>
                {files.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {files.map((file, index) => (
                      <li
                        key={`${file.name}-${index}`}
                        className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm text-slate-700"
                      >
                        <span className="min-w-0 truncate">
                          {file.name}
                          <span className="ml-2 text-xs text-slate-400">
                            {Math.max(1, Math.round(file.size / 1024))} KB
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                          aria-label={`Hapus ${file.name} dari daftar`}
                          className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 hover:text-black"
                        >
                          <X size={14} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs text-slate-500">
                  Setelah job dibuat, hasil pemeriksaan AI ditampilkan dulu untuk Anda periksa sebelum
                  dokumen tersimpan.
                </p>
              </section>
            </div>

            <div className="shrink-0 border-t px-6 py-4 sm:px-8">
              {error && <p className="mb-4 text-sm text-rose-700">{error}</p>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={onCancel} className="btn-secondary">
                  Batal
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Menyimpan...' : 'Buat job'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      <Dialog open={editor !== null} onOpenChange={(open) => !open && setEditor(null)}>
        <DialogContent className="z-[60] flex h-[min(85vh,900px)] max-h-[85vh] w-[calc(100%-2rem)] flex-col overflow-hidden p-0 sm:max-w-[min(92vw,860px)]">
          {editor ? (
            <form onSubmit={applyEditor} className="flex min-h-0 flex-1 flex-col">
              <DialogHeader className="shrink-0 rounded-none border-b px-5 py-4 sm:px-6">
                <DialogTitle>
                  Edit {editor.side === 'INVOICE' ? 'invoice' : 'B/L atau AWB'} —{' '}
                  <span className="font-normal">{items[editor.index]?.file.name}</span>
                </DialogTitle>
                <DialogDescription>
                  Koreksi disimpan ke job saat Anda menekan Konfirmasi &amp; selesaikan.
                </DialogDescription>
              </DialogHeader>
              <div className="flex min-h-0 flex-1 flex-col">
                {editor.side === 'INVOICE' && editorInvoice ? (
                  <InvoiceEditor value={editorInvoice} onChange={setEditorInvoice} />
                ) : editor.side === 'TRANSPORT' && editorTransport ? (
                  <TransportEditor value={editorTransport} onChange={setEditorTransport} />
                ) : null}
              </div>
              <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none border-t px-5 py-4 sm:px-6">
                <Button type="button" variant="outline" onClick={() => setEditor(null)}>
                  Batal
                </Button>
                <Button type="submit">Selesai</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmCancel}
        onOpenChange={(open) => {
          if (!deleting) setConfirmCancel(open)
        }}
      >
        <DialogContent className="z-[60] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Batalkan pembuatan job?</DialogTitle>
            <DialogDescription>
              Job yang baru dibuat akan dihapus permanen bersama dokumen yang sudah diperiksa.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmCancel(false)}
              disabled={deleting}
            >
              Lanjutkan memeriksa
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={cancelAndDelete}
              disabled={deleting}
            >
              {deleting ? 'Menghapus...' : 'Ya, batalkan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
