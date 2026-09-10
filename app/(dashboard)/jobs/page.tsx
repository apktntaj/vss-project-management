'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  FileWarning,
  FileText,
  Plane,
  Search,
  Ship,
  SlidersHorizontal,
  Truck,
  Upload,
} from 'lucide-react'
import {
  getOperationalDetails,
  listEvents,
  listJobs,
  saveJobDocument,
  type LocalEvent,
  type LocalJob,
  type LocalJobDocument,
  type JobInvoiceExtraction,
  type JobTransportExtraction,
} from '@/lib/data-client'
import { StatusBadge } from '@/components/status-badge'
import { JobDocumentEditorDialog, type EditableJobDocument } from '@/components/job-document-editor-dialog'
import { Button } from '@/components/ui/button'
import { finishLoadingAfterMinimum, PageSkeleton } from '@/components/loading-skeletons'
import { Skeleton } from '@/components/ui/skeleton'

type Scope = 'active' | 'all'

const MINIMUM_CLASSIFICATION_SKELETON_MS = 600

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))
}
type AcceptedDocumentKind = 'BILL_OF_LADING' | 'AIR_WAYBILL' | 'COMMERCIAL_INVOICE'
type DocumentClassification = {
  documentType: AcceptedDocumentKind | 'OTHER' | 'UNREADABLE'
  confidence: number
  rationale: string | null
}
const spreadsheetExtensions = ['xls', 'xlsx', 'xlsm', 'xlsb', 'xltx', 'xltm']
const fileExtension = (file: File) => file.name.split('.').pop()?.toLowerCase()
const isPdf = (file: File) => file.type === 'application/pdf' || fileExtension(file) === 'pdf'
const isAcceptedJobDocument = (file: File) => isPdf(file) || spreadsheetExtensions.includes(fileExtension(file) || '')
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(
        new Date(value),
      )
    : '—'
const activeEvent = (event: LocalEvent | undefined) =>
  !!event && new Date(`${event.endsOn}T23:59:59`) >= new Date()
const label = (key: string) => key.replaceAll('_', ' ')
const normalizedName = (value: string | null | undefined) => value?.toLocaleLowerCase('id-ID').replace(/[^\p{L}\p{N}]+/gu, '') ?? ''

function documentDifferences(invoice: JobInvoiceExtraction, transport: JobTransportExtraction) {
  const values = [
    ['berat bruto', invoice.totalGrossWeightKg, transport.grossWeightKg],
    ['berat netto', invoice.totalNetWeightKg, transport.netWeightKg],
    ['jumlah kemasan', invoice.totalPackageCount, transport.packageCount],
    ['jenis kemasan', invoice.packageType, transport.packageType],
  ] as const
  return values.flatMap(([name, invoiceValue, transportValue]) => {
    if (invoiceValue === null || transportValue === null) return []
    const differs = typeof invoiceValue === 'number' && typeof transportValue === 'number'
      ? Math.abs(invoiceValue - transportValue) > 0.001
      : String(invoiceValue).trim().toLocaleUpperCase('id-ID') !== String(transportValue).trim().toLocaleUpperCase('id-ID')
    return differs ? [name] : []
  })
}

function CustomsProgress({ job, onGenerate }: { job: LocalJob; onGenerate: (job: LocalJob, documentType: keyof ReturnType<typeof getOperationalDetails>['customs']) => void }) {
  const customs = getOperationalDetails(job).customs
  return (
    <div className="flex min-w-[175px] gap-1">
      {(Object.keys(customs) as Array<keyof typeof customs>).map((key) => {
        const item = customs[key]
        const tone = !item.applicable
          ? 'border-slate-200 bg-slate-50 text-slate-400'
          : item.status === 'COMPLETED'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : item.status === 'ON_HOLD'
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : item.status === 'NOT_STARTED'
                ? 'border-slate-200 bg-white text-slate-500'
                : 'border-blue-200 bg-blue-50 text-blue-800'
        return (
          <button
            type="button"
            key={key}
            disabled={!item.applicable}
            onClick={() => onGenerate(job, key)}
            className={`min-w-0 flex-1 rounded-lg border px-1.5 py-1 text-center text-[10px] font-semibold ${tone}`}
            title={item.applicable ? `${label(key)} · Klik untuk mengunduh Excel` : `${label(key)} · Tidak diperlukan`}
          >
            <span className="block">{label(key)}</span>
            <span className="mt-0.5 block truncate font-normal">
              {item.applicable
                ? item.registrationNumber || item.ajuNumber || label(item.status)
                : 'N/A'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function JobRowSkeleton() {
  return (
    <tr aria-busy="true" aria-label="Memproses dokumen shipment">
      <td className="px-3 py-3"><Skeleton className="h-5 w-20" /><Skeleton className="mt-2 h-3 w-16" /></td>
      <td className="px-3 py-3"><Skeleton className="h-5 w-28" /><Skeleton className="mt-2 h-3 w-20" /></td>
      <td className="px-3 py-3"><Skeleton className="h-5 w-36" /><Skeleton className="mt-2 h-3 w-28" /></td>
      <td className="px-3 py-3"><Skeleton className="h-5 w-20" /><Skeleton className="mt-2 h-3 w-24" /></td>
      <td className="px-3 py-3"><Skeleton className="h-12 w-full" /></td>
      <td className="px-3 py-3"><Skeleton className="h-5 w-20" /><Skeleton className="mt-2 h-5 w-16" /></td>
    </tr>
  )
}

function JobRow({
  job,
  onDocumentUploaded,
  onToast,
  onGenerate,
  onEditDocument,
}: {
  job: LocalJob
  onDocumentUploaded: (
    jobId: string,
    document: LocalJobDocument,
    extraction?: { invoice?: JobInvoiceExtraction | null; transport?: JobTransportExtraction | null },
  ) => void
  onToast: (message: string, tone?: 'info' | 'error') => void
  onGenerate: (job: LocalJob, documentType: keyof ReturnType<typeof getOperationalDetails>['customs']) => void
  onEditDocument: (job: LocalJob, kind: EditableJobDocument) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const operational = getOperationalDetails(job)
  const inbound = operational.inbound
  const exhibitorName = job.exhibitor?.legalName || job.clientName
  const shipperName = operational.inboundDocument?.shipper?.name || job.shipper
  const jobInitiator = job.createdBy ?? job.assignedTo
  const exhibitorDiffersFromShipper = Boolean(
    job.exhibitor?.legalName && shipperName && normalizedName(job.exhibitor.legalName) !== normalizedName(shipperName),
  )
  const TransportIcon = inbound.mode === 'AIR' ? Plane : inbound.mode === 'SEA' ? Ship : Truck
  async function uploadShipmentDocument(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return
    const acceptedFiles = files.filter(isAcceptedJobDocument)
    if (acceptedFiles.length !== files.length) {
      onToast('File harus berupa PDF atau Excel (.xls, .xlsx, .xlsm, .xlsb, .xltx, .xltm).', 'error')
    }
    if (!acceptedFiles.length) return
    const loadingStartedAt = Date.now()
    setUploading(true)
    const confidences: number[] = []
    let uploadedInvoice: JobInvoiceExtraction | null = null
    let uploadedTransport: JobTransportExtraction | null = null
    try {
      for (const file of acceptedFiles) {
        try {
          const formData = new FormData()
          formData.set('file', file)
          const response = await fetch('/api/classify-job-document', { method: 'POST', body: formData })
          const payload = await response.json() as {
            classification?: DocumentClassification
            invoice?: JobInvoiceExtraction | null
            transport?: JobTransportExtraction | null
            error?: string
          }
          if (!response.ok || !payload.classification) throw new Error(payload.error || 'Dokumen tidak dapat diperiksa.')
          const classification = payload.classification
          const kind = classification.documentType === 'UNREADABLE' ? 'OTHER' : classification.documentType
          const document = await saveJobDocument(job.id, file, kind, payload.invoice, payload.transport)
          onDocumentUploaded(job.id, document, { invoice: payload.invoice, transport: payload.transport })
          if (payload.invoice) uploadedInvoice = payload.invoice
          if (payload.transport) uploadedTransport = payload.transport
          confidences.push(classification.confidence)
        } catch (caught) {
          try {
            const document = await saveJobDocument(job.id, file, 'OTHER')
            onDocumentUploaded(job.id, document)
            onToast(`Dokumen tetap disimpan sebagai dokumen lain. ${caught instanceof Error ? caught.message : 'Gemini tidak dapat memeriksa dokumen.'}`)
          } catch {
            onToast('Dokumen tidak dapat disimpan.', 'error')
          }
        }
      }
      if (confidences.length) {
        const invoice = uploadedInvoice ?? operational.invoice
        const transport = uploadedTransport ?? operational.inboundDocument
        const differences = invoice && transport ? documentDifferences(invoice, transport) : []
        const confidenceMessage = `keyakinan Gemini ${confidences.map((confidence) => `${Math.round(confidence * 100)}%`).join(', ')}`
        if (differences.length) {
          onToast(`Dokumen tersimpan · ${confidenceMessage}. Perlu cek: ${differences.join(', ')} berbeda antara Invoice dan B/L/AWB.`, 'error')
        } else if (invoice && transport) {
          onToast(`Dokumen tersimpan · ${confidenceMessage}. Data Invoice dan B/L/AWB konsisten untuk field yang tersedia.`)
        } else {
          onToast(`Dokumen tersimpan · ${confidenceMessage}`)
        }
      }
    } finally {
      const remainingDuration = MINIMUM_CLASSIFICATION_SKELETON_MS - (Date.now() - loadingStartedAt)
      if (remainingDuration > 0) await wait(remainingDuration)
      setUploading(false)
    }
  }
  if (uploading) return <JobRowSkeleton />

  return (
    <tr className="border-b border-slate-100 odd:bg-slate-50/70 last:border-0 hover:bg-orange-50/40">
      <td className="px-3 py-3 align-top">
        <Link
          href={`/jobs/${job.id}`}
          className="font-semibold text-slate-900 hover:text-orange-700"
        >
          {job.jobNumber}
        </Link>
        <p className="mt-1">
          <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-inset ring-sky-200">
            {date(job.createdAt)}
          </span>
        </p>
      </td>
      <td className="w-[145px] max-w-[145px] px-3 py-3 align-top">
        <p
          className="truncate font-medium text-slate-800"
          title={exhibitorName}
        >
          {exhibitorName}
        </p>
        {exhibitorDiffersFromShipper && (
          <p className="mt-1 flex items-center gap-1 text-xs font-medium text-destructive" title={`Nama Exhibitor berbeda dari Shipper pada B/L: ${shipperName}`}>
            <CircleAlert aria-hidden="true" /> Berbeda dengan Shipper B/L
          </p>
        )}
        <p
          className="mt-1 truncate"
          title={job.agent || 'Agent belum diisi'}
        >
          <span className="inline-flex max-w-full truncate rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200">
            {job.agent || 'Agent belum diisi'}
          </span>
        </p>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label={`Upload dokumen shipment untuk ${job.jobNumber}`}
            title="Upload satu atau beberapa dokumen shipment"
            className="mt-0.5 shrink-0 rounded p-0.5 text-slate-400 hover:bg-orange-100 hover:text-orange-700"
          >
            <Upload size={16} aria-hidden="true" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="application/pdf,.pdf,application/vnd.ms-excel,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx,application/vnd.ms-excel.sheet.macroEnabled.12,.xlsm,application/vnd.ms-excel.sheet.binary.macroEnabled.12,.xlsb,application/vnd.openxmlformats-officedocument.spreadsheetml.template,.xltx,application/vnd.ms-excel.template.macroEnabled.12,.xltm"
            onChange={uploadShipmentDocument}
            className="sr-only"
            tabIndex={-1}
          />
          <div className="min-w-0">
            <Button type="button" variant="link" size="sm" onClick={() => onEditDocument(job, 'TRANSPORT')}>
              {inbound.documentType || 'Masuk'} · {inbound.documentNumber || 'Belum ada dokumen'}
            </Button>
            <p className="mt-1">
              <Button type="button" variant="link" size="xs" className="text-primary hover:text-primary/80" onClick={() => onEditDocument(job, 'INVOICE')}>
                <FileText data-icon="inline-start" />Invoice: {operational.invoiceNumber || 'Belum ada dokumen'}
              </Button>
            </p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex items-start gap-2">
          <TransportIcon size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-slate-700">{date(inbound.scheduleAt)}</p>
            <p className="mt-1">
              <span className="inline-flex max-w-full truncate rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                {inbound.carrier || '-'}
              </span>
            </p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        <CustomsProgress job={job} onGenerate={onGenerate} />
      </td>
      <td className="px-3 py-3 align-top">
        <p className="text-sm font-medium text-slate-700">
          {jobInitiator?.name || 'Belum ada inisiator'}
        </p>
        <div className="mt-2">
          <StatusBadge status={job.status} />
        </div>
      </td>
    </tr>
  )
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<LocalJob[]>([])
  const [events, setEvents] = useState<LocalEvent[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [scope, setScope] = useState<Scope>('active')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [toast, setToast] = useState<{ message: string; tone: 'info' | 'error' } | null>(null)
  const [editingDocument, setEditingDocument] = useState<{ job: LocalJob; kind: EditableJobDocument } | null>(null)
  const [loading, setLoading] = useState(true)
  const loadingStartedAt = useRef(Date.now())
  useEffect(() => {
    Promise.all([listJobs(), listEvents()]).then(([loadedJobs, loadedEvents]) => {
      setJobs(loadedJobs)
      setEvents(loadedEvents)
      setOpen(Object.fromEntries(loadedEvents.map((event) => [event.id, true])))
      finishLoadingAfterMinimum(loadingStartedAt.current, () => setLoading(false))
    })
  }, [])
  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 7000)
    return () => window.clearTimeout(timeout)
  }, [toast])
  const showToast = (message: string, tone: 'info' | 'error' = 'info') => setToast({ message, tone })
  const handleDocumentSaved = (updated: LocalJob) => {
    setJobs((current) => current.map((job) => job.id === updated.id ? updated : job))
  }
  async function generateCustomsWorkbook(job: LocalJob, documentType: keyof ReturnType<typeof getOperationalDetails>['customs']) {
    try {
      const response = await fetch('/api/export-customs-workbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job, documentType }),
      })
      if (!response.ok) {
        const payload = await response.json() as { error?: string }
        throw new Error(payload.error || 'File BC tidak dapat dibuat.')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${documentType.replaceAll('_', '-')}-${job.jobNumber}.xlsx`
      anchor.click()
      URL.revokeObjectURL(url)
      showToast(`${label(documentType)} berhasil diunduh.`)
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'File BC tidak dapat dibuat.', 'error')
    }
  }
  const handleDocumentUploaded = (
    jobId: string,
    document: LocalJobDocument,
    extraction?: { invoice?: JobInvoiceExtraction | null; transport?: JobTransportExtraction | null },
  ) => {
    setJobs((current) =>
      current.map((job) =>
        job.id === jobId
          ? {
              ...job,
              documents: [...job.documents, document],
              ...(extraction?.transport
                ? {
                    blNumber: document.kind === 'BILL_OF_LADING' ? extraction.transport.documentNumber : job.blNumber,
                    awbNumber: document.kind === 'AIR_WAYBILL' ? extraction.transport.documentNumber : job.awbNumber,
                    shippingLine: extraction.transport.carrier,
                    ...(extraction.transport.shipper?.name ? { shipper: extraction.transport.shipper.name } : {}),
                    ...(extraction.transport.consignee?.name ? { consignee: extraction.transport.consignee.name } : {}),
                    ...(extraction.transport.notifyParty?.name ? { notifyParty: extraction.transport.notifyParty.name } : {}),
                  }
                : {}),
              operational: extraction?.invoice || extraction?.transport
                ? {
                    ...getOperationalDetails(job),
                    inbound: extraction.transport
                      ? {
                          ...getOperationalDetails(job).inbound,
                          mode: document.kind === 'BILL_OF_LADING' ? 'SEA' : 'AIR',
                          documentType: document.kind === 'BILL_OF_LADING' ? 'BL' : 'AWB',
                          documentNumber: extraction.transport.documentNumber,
                          carrier: extraction.transport.carrier,
                          scheduleAt: extraction.transport.eta ?? getOperationalDetails(job).inbound.scheduleAt,
                        }
                      : getOperationalDetails(job).inbound,
                    ...(extraction.transport ? { inboundDocument: extraction.transport } : {}),
                    ...(extraction.invoice
                      ? {
                          invoiceNumber: extraction.invoice.invoiceNumber ?? getOperationalDetails(job).invoiceNumber ?? null,
                          invoiceItems: extraction.invoice.items,
                          invoice: extraction.invoice,
                        }
                      : {}),
                  }
                : job.operational,
            }
          : job,
      ),
    )
  }
  const eventById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events])
  const filtered = useMemo(
    () =>
      jobs.filter((job) => {
        const operational = getOperationalDetails(job)
        const haystack = [
          job.jobNumber,
          job.blNumber,
          job.awbNumber,
          operational.inbound.documentNumber,
          operational.outbound.documentNumber,
          ...Object.values(operational.customs).flatMap((item) =>
            item.billing.kind === 'INVOICED' || item.billing.kind === 'PAID'
              ? [item.billing.reference]
              : [],
          ),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return (
          (!search || haystack.includes(search.toLowerCase())) &&
          (!status || job.status === status) &&
          (scope === 'all' || activeEvent(job.eventId ? eventById.get(job.eventId) : undefined))
        )
      }),
    [jobs, search, status, scope, eventById],
  )
  const grouped = useMemo(
    () =>
      filtered.reduce<Record<string, LocalJob[]>>((all, job) => {
        const key = job.eventId || 'without-event'
        ;(all[key] ||= []).push(job)
        return all
      }, {}),
    [filtered],
  )
  const waitingCipl = filtered.filter(
    (job) => getOperationalDetails(job).cipl.status === 'MISSING',
  ).length
  const needsAction = filtered.filter((job) =>
    Object.values(getOperationalDetails(job).customs).some(
      (item) => item.applicable && item.status !== 'COMPLETED',
    ),
  ).length
  const activeJobs = jobs.filter((job) => job.status === 'IN_PROGRESS').length
  const pendingJobs = jobs.filter(
    (job) => job.status === 'DRAFT' || job.status === 'ON_HOLD',
  ).length
  const hasFilters = Boolean(search || status || scope !== 'active')
  const clearFilters = () => {
    setSearch('')
    setStatus('')
    setScope('active')
  }
  if (loading) return <PageSkeleton cards={3} rows={6} />

  return (
    <div className="space-y-6">
      <section>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Jobs</h1>
        <p className="mt-2 text-sm text-slate-500">Kelola milestone job berdasarkan tenggatnya.</p>
      </section>
      <section className="grid gap-3 lg:grid-cols-3">
        <div className="card p-5" aria-labelledby="jobs-summary-title">
          <h2 id="jobs-summary-title" className="text-lg font-semibold">
            Summary
          </h2>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-700">{activeJobs}</p>
              <p className="mt-1 text-xs text-slate-500">Job aktif</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-700">{pendingJobs}</p>
              <p className="mt-1 text-xs text-slate-500">Job pending</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-700">{jobs.length}</p>
              <p className="mt-1 text-xs text-slate-500">Total job</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="text-lg font-semibold">Checkpoint event</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">Soon.</p>
        </div>
        <div className="card p-5">
          <h2 className="text-lg font-semibold">Attention</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div>
              <FileWarning className="mx-auto text-amber-700" size={18} />
              <p className="mt-1 text-2xl font-bold text-amber-700">{waitingCipl}</p>
              <p className="mt-1 text-xs text-slate-500">Menunggu CIPL</p>
            </div>
            <div>
              <SlidersHorizontal className="mx-auto text-orange-700" size={18} />
              <p className="mt-1 text-2xl font-bold text-orange-700">{needsAction}</p>
              <p className="mt-1 text-xs text-slate-500">Perlu tindak lanjut</p>
            </div>
          </div>
        </div>
      </section>
      <section>
        <div className="mb-5 p-0">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative w-full lg:w-80 lg:flex-none">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="input m-0 border-0 bg-slate-50 pl-10 shadow-none"
              placeholder="Cari nomor Job, B/L, AWB, atau invoice"
            />
          </label>
          <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2 px-0 py-2">
            {[
              ['', 'All'],
              ['DRAFT', 'Draft'],
              ['IN_PROGRESS', 'On going'],
              ['ON_HOLD', 'On hold'],
              ['COMPLETED', 'Done'],
            ].map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="job-status"
                  value={value}
                  checked={status === value}
                  onChange={() => setStatus(value)}
                  className="h-4 w-4 accent-orange-600"
                />
                {label}
              </label>
            ))}
          </fieldset>
          <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm font-medium">
            <button
              onClick={() => setScope('active')}
              className={`rounded-md px-3 py-1.5 ${scope === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              Event aktif
            </button>
            <button
              onClick={() => setScope('all')}
              className={`rounded-md px-3 py-1.5 ${scope === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              Semua
            </button>
          </div>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 text-sm font-semibold text-orange-700 hover:text-orange-800"
            >
              Reset filter
            </button>
          )}
        </div>
      </section>
      {Object.entries(grouped).map(([eventId, eventJobs]) => {
        const event = eventById.get(eventId)
        const isOpen = open[eventId] ?? true
        return (
          <section key={eventId} className="card overflow-hidden">
            <button
              onClick={() => setOpen((value) => ({ ...value, [eventId]: !isOpen }))}
              className="flex w-full items-center gap-3 border-b bg-slate-50 px-5 py-4 text-left hover:bg-slate-100"
            >
              <span className="text-slate-400">
                {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-slate-900">
                  {event?.officialName || 'Job tanpa event'}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {event
                    ? `${date(event.startsAt)} – ${date(event.endsAt)}`
                    : 'Perlu ditautkan ke event'}
                </span>
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                {eventJobs.length} Job
              </span>
            </button>
            {isOpen && (
              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[115px]" />
                    <col className="w-[145px]" />
                    <col className="w-[190px]" />
                    <col className="w-[135px]" />
                    <col className="w-[210px]" />
                    <col className="w-[105px]" />
                  </colgroup>
                  <thead className="border-b bg-white text-slate-900 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-3">No Job</th>
                      <th className="px-3 py-3">Exhibitor</th>
                      <th className="px-3 py-3">Dokumen shipment</th>
                      <th className="px-3 py-3">ETA</th>
                      <th className="px-3 py-3">Dokumen BC</th>
                      <th className="px-3 py-3">PIC (Inisiator)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventJobs.map((job) => (
                        <JobRow key={job.id} job={job} onDocumentUploaded={handleDocumentUploaded} onToast={showToast} onGenerate={generateCustomsWorkbook} onEditDocument={(selectedJob, kind) => setEditingDocument({ job: selectedJob, kind })} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )
      })}
      {!filtered.length && (
        <section className="card p-12 text-center">
          <p className="font-semibold text-slate-800">Tidak ada Job yang sesuai</p>
          <p className="mt-2 text-sm text-slate-500">
            Ubah pencarian atau filter untuk melihat Job lain.
          </p>
        </section>
      )}
      <JobDocumentEditorDialog
        job={editingDocument?.job ?? null}
        kind={editingDocument?.kind ?? 'INVOICE'}
        open={Boolean(editingDocument)}
        onOpenChange={(nextOpen) => { if (!nextOpen) setEditingDocument(null) }}
        onSaved={handleDocumentSaved}
        onToast={showToast}
      />
      {toast && <div role="status" className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border px-4 py-3 text-sm shadow-lg ${toast.tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{toast.message}</div>}
    </div>
  )
}
