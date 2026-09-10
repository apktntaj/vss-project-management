'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  FileWarning,
  LoaderCircle,
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
} from '@/lib/data-client'
import { StatusBadge } from '@/components/status-badge'

type Scope = 'active' | 'all'
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

function CustomsProgress({ job }: { job: LocalJob }) {
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
          <div
            key={key}
            className={`min-w-0 flex-1 rounded-lg border px-1.5 py-1 text-center text-[10px] font-semibold ${tone}`}
            title={`${label(key)} · ${item.applicable ? item.status : 'Tidak diperlukan'}`}
          >
            <span className="block">{label(key)}</span>
            <span className="mt-0.5 block truncate font-normal">
              {item.applicable
                ? item.registrationNumber || item.ajuNumber || label(item.status)
                : 'N/A'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function JobRow({
  job,
  onDocumentUploaded,
  onToast,
}: {
  job: LocalJob
  onDocumentUploaded: (jobId: string, document: LocalJobDocument, invoice?: JobInvoiceExtraction | null) => void
  onToast: (message: string, tone?: 'info' | 'error') => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const operational = getOperationalDetails(job)
  const inbound = operational.inbound
  const TransportIcon = inbound.mode === 'AIR' ? Plane : inbound.mode === 'SEA' ? Ship : Truck
  async function uploadShipmentDocument(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!isAcceptedJobDocument(file)) {
      onToast('File harus berupa PDF atau Excel (.xls, .xlsx, .xlsm, .xlsb, .xltx, .xltm).', 'error')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.set('file', file)
      const response = await fetch('/api/classify-job-document', { method: 'POST', body: formData })
      const payload = await response.json() as { classification?: DocumentClassification; invoice?: JobInvoiceExtraction | null; error?: string }
      if (!response.ok || !payload.classification) throw new Error(payload.error || 'Dokumen tidak dapat diperiksa.')
      const classification = payload.classification
      const kind = classification.documentType === 'UNREADABLE' ? 'OTHER' : classification.documentType
      const invoice = payload.invoice
      const document = await saveJobDocument(job.id, file, kind, invoice)
      onDocumentUploaded(job.id, document, invoice)
      onToast(`Berhasil · keyakinan Gemini ${Math.round(classification.confidence * 100)}%`)
    } catch (caught) {
      try {
        const document = await saveJobDocument(job.id, file, 'OTHER')
        onDocumentUploaded(job.id, document)
        onToast(`Dokumen tetap disimpan sebagai dokumen lain. ${caught instanceof Error ? caught.message : 'Gemini tidak dapat memeriksa dokumen.'}`)
      } catch {
        onToast('Dokumen tidak dapat disimpan.', 'error')
      }
    } finally {
      setUploading(false)
    }
  }
  return (
    <tr className="border-b border-slate-100 odd:bg-slate-50/70 last:border-0 hover:bg-orange-50/40">
      <td className="px-3 py-3 align-top">
        <Link
          href={`/jobs/${job.id}`}
          className="font-semibold text-slate-900 hover:text-orange-700"
        >
          {job.jobNumber}
        </Link>
        <p className="mt-1 text-xs text-slate-500"> {date(job.createdAt)}</p>
      </td>
      <td className="w-[145px] max-w-[145px] px-3 py-3 align-top">
        <p
          className="truncate font-medium text-slate-800"
          title={job.exhibitor?.legalName || job.shipper || job.clientName}
        >
          {job.exhibitor?.legalName || job.shipper || job.clientName}
        </p>
        <p
          className="mt-1 truncate text-xs text-slate-500"
          title={job.agent || 'Agent belum diisi'}
        >
          {job.agent || 'Agent belum diisi'}
        </p>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label={`Upload dokumen shipment untuk ${job.jobNumber}`}
            title="Upload dokumen shipment"
            className="mt-0.5 shrink-0 rounded p-0.5 text-slate-400 hover:bg-orange-100 hover:text-orange-700 disabled:cursor-wait disabled:opacity-60"
          >
            {uploading ? (
              <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Upload size={16} aria-hidden="true" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf,application/vnd.ms-excel,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx,application/vnd.ms-excel.sheet.macroEnabled.12,.xlsm,application/vnd.ms-excel.sheet.binary.macroEnabled.12,.xlsb,application/vnd.openxmlformats-officedocument.spreadsheetml.template,.xltx,application/vnd.ms-excel.template.macroEnabled.12,.xltm"
            onChange={uploadShipmentDocument}
            className="sr-only"
            tabIndex={-1}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-700">
              {inbound.documentType || 'Masuk'} · {inbound.documentNumber || 'Belum ada dokumen'}
            </p>
            <p className="mt-1 text-xs text-slate-500">No. Invoice: {operational.invoiceNumber || '-'}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex items-start gap-2">
          <TransportIcon size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-slate-700">{date(inbound.scheduleAt)}</p>
            <p className="mt-1 text-xs text-slate-500">
              {inbound.mode === 'AIR'
                ? 'Udara'
                : inbound.mode === 'SEA'
                  ? 'Laut'
                  : inbound.mode === 'LOCAL'
                    ? 'Lokal'
                    : 'Moda belum ditentukan'}
              {inbound.carrier ? ` · ${inbound.carrier}` : ''}
            </p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        <CustomsProgress job={job} />
      </td>
      <td className="px-3 py-3 align-top">
        <p className="text-sm font-medium text-slate-700">
          {job.assignedTo?.name || 'Belum ada PIC'}
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
  useEffect(() => {
    Promise.all([listJobs(), listEvents()]).then(([loadedJobs, loadedEvents]) => {
      setJobs(loadedJobs)
      setEvents(loadedEvents)
      setOpen(Object.fromEntries(loadedEvents.map((event) => [event.id, true])))
    })
  }, [])
  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 7000)
    return () => window.clearTimeout(timeout)
  }, [toast])
  const showToast = (message: string, tone: 'info' | 'error' = 'info') => setToast({ message, tone })
  const handleDocumentUploaded = (jobId: string, document: LocalJobDocument, invoice?: JobInvoiceExtraction | null) => {
    setJobs((current) =>
      current.map((job) =>
        job.id === jobId
          ? {
              ...job,
              documents: [...job.documents, document],
              operational: invoice
                ? {
                    ...getOperationalDetails(job),
                    invoiceNumber: invoice.invoiceNumber ?? getOperationalDetails(job).invoiceNumber ?? null,
                    invoiceItems: invoice.items,
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
      <section className="card p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <label className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="input m-0 bg-slate-50 pl-10"
              placeholder="Cari nomor Job, B/L, AWB, atau invoice"
            />
          </label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="input m-0 lg:w-52"
          >
            <option value="">Semua status Job</option>
            <option value="DRAFT">Draf</option>
            <option value="IN_PROGRESS">Diproses</option>
            <option value="ON_HOLD">Ditunda</option>
            <option value="COMPLETED">Selesai</option>
            <option value="CANCELLED">Dibatalkan</option>
          </select>
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
                      <th className="px-3 py-3">PIC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventJobs.map((job) => (
                      <JobRow key={job.id} job={job} onDocumentUploaded={handleDocumentUploaded} onToast={showToast} />
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
      {toast && <div role="status" className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border px-4 py-3 text-sm shadow-lg ${toast.tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{toast.message}</div>}
    </div>
  )
}
