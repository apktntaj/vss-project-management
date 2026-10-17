'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  FileText,
  Pencil,
  ShieldCheck,
  ShipWheel,
} from 'lucide-react'
import {
  getJob,
  getOperationalDetails,
  listEventExhibitors,
  listEventJobs,
  type LocalExhibitor,
  type LocalJob,
} from '@/lib/data-client'
import { internationalJobJenisLabels } from '@/domain/job/types'
import { buildJobNomor } from '@/lib/job-number'
import { buildManifestView } from '@/lib/manifest-view'
import { StatusBadge } from '@/components/status-badge'
import { JobManifestSection } from '@/components/job-manifest-section'
import { JobManifestEditorModal } from '@/components/job-manifest-editor-modal'
import { ExhibitorLogisticsModal } from '@/components/exhibitor-logistics-modal'
import { finishLoadingAfterMinimum, PageSkeleton } from '@/components/loading-skeletons'
import { compareInvoiceWithTransport, type DocumentComparison } from '@/lib/document-comparison'
import { ContextTicketList } from '@/components/context-ticket-list'

const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value))
    : 'Belum diisi'
const label = (value: string) => value.replaceAll('_', ' ')

function Info({ label: title, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-800">{value || '—'}</dd>
    </div>
  )
}

const jenisLabel = (job: LocalJob) =>
  job.kind === 'LOCAL'
    ? 'Local'
    : job.internationalJenis
      ? internationalJobJenisLabels[job.internationalJenis]
      : 'Job lama'

function comparisonValue(value: DocumentComparison['invoiceValue']) {
  return value === null ? 'Tidak tersedia' : String(value)
}

function DocumentComparisonSummary({ comparison }: { comparison: DocumentComparison[] }) {
  const differences = comparison.filter((item) => item.status === 'DIFFERENT')
  const comparable = comparison.filter((item) => item.status !== 'UNAVAILABLE')
  if (!comparison.length) return null
  return (
    <section
      id="pemeriksaan-dokumen"
      className={`card p-5 ${differences.length ? 'border-amber-300 bg-amber-50/50' : 'border-emerald-200 bg-emerald-50/40'}`}
    >
      <div className="flex items-start gap-3">
        {differences.length ? (
          <CircleAlert className="mt-0.5 shrink-0 text-amber-700" size={20} aria-hidden="true" />
        ) : (
          <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-700" size={20} aria-hidden="true" />
        )}
        <div>
          <h2 className="font-semibold">Pemeriksaan Invoice vs B/L/AWB</h2>
          <p className="mt-1 text-sm text-slate-600">
            {differences.length
              ? `${differences.length} data berbeda dan perlu ditinjau.`
              : comparable.length
                ? 'Data yang tersedia konsisten.'
                : 'Gemini belum menemukan nilai yang sama-sama tersedia untuk dibandingkan.'}
          </p>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="pb-2 pr-3">Data</th>
              <th className="pb-2 pr-3">Invoice</th>
              <th className="pb-2 pr-3">B/L / AWB</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {comparison.map((item) => (
              <tr key={item.field} className="border-b border-slate-200/80 last:border-0">
                <td className="py-2.5 pr-3 font-medium text-slate-800">{item.label}</td>
                <td className="py-2.5 pr-3 text-slate-600">{comparisonValue(item.invoiceValue)}</td>
                <td className="py-2.5 pr-3 text-slate-600">
                  {comparisonValue(item.transportValue)}
                </td>
                <td className="py-2.5">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${item.status === 'DIFFERENT' ? 'bg-amber-100 text-amber-800' : item.status === 'MATCH' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}
                  >
                    {item.status === 'DIFFERENT'
                      ? 'Berbeda'
                      : item.status === 'MATCH'
                        ? 'Sama'
                        : 'Belum tersedia'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function JobDetail({ params }: { params: { id: string } }) {
  const [job, setJob] = useState<LocalJob | null>(null)
  const [loading, setLoading] = useState(true)
  const loadingStartedAt = useRef(Date.now())
  useEffect(() => {
    loadingStartedAt.current = Date.now()
    setLoading(true)
    getJob(params.id).then((loadedJob) => {
      setJob(loadedJob)
      finishLoadingAfterMinimum(loadingStartedAt.current, () => setLoading(false))
    })
  }, [params.id])
  const [exhibitors, setExhibitors] = useState<LocalExhibitor[]>([])
  const [nomor, setNomor] = useState<string | null>(null)
  const [manifestModalOpen, setManifestModalOpen] = useState(false)
  const [logisticsTarget, setLogisticsTarget] = useState<LocalExhibitor | null>(null)
  const jobEventId = job?.eventId ?? null
  useEffect(() => {
    if (!jobEventId) {
      setExhibitors([])
      return
    }
    let active = true
    listEventExhibitors(jobEventId)
      .then((rows) => {
        if (active) setExhibitors(rows)
      })
      .catch(() => {
        if (active) setExhibitors([])
      })
    return () => {
      active = false
    }
  }, [jobEventId])
  useEffect(() => {
    if (!jobEventId) {
      setNomor(null)
      return
    }
    let active = true
    listEventJobs(jobEventId)
      .then((eventJobs) => {
        if (active) setNomor(buildJobNomor(eventJobs).get(params.id) ?? null)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [jobEventId, params.id])
  if (loading || !job) return <PageSkeleton cards={2} rows={5} />
  const showManifest =
    job.kind === 'INTERNATIONAL' || Boolean(job.inward) || Boolean(job.kepulangan)
  const details = getOperationalDetails(job)
  const completed = Object.values(details.customs).filter(
    (item) => item.applicable && item.status === 'COMPLETED',
  ).length
  const required = Object.values(details.customs).filter((item) => item.applicable).length
  const invoiceItems = details.invoiceItems ?? []
  const documentComparison =
    details.invoice && details.inboundDocument
      ? compareInvoiceWithTransport(details.invoice, details.inboundDocument)
      : null
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/jobs"
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-orange-700"
          >
            <ArrowLeft size={16} /> Kembali ke Jobs
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {nomor || job.jobNumber || 'No Job belum diisi'}
            </h1>
            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 ring-1 ring-inset ring-violet-200">
              {jenisLabel(job)}
            </span>
            <StatusBadge status={job.status} />
          </div>
          <p className="mt-2 text-sm text-slate-500">
            ID internal {job.id} · {job.exhibitor?.legalName || job.shipper || job.clientName} ·{' '}
            {job.kind === 'LOCAL' ? 'Tanpa agent (lokal)' : job.agent || 'Agent belum diisi'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/lartas" className="btn-secondary">
            <ShieldCheck size={16} /> Cek LARTAS
          </Link>
          <Link href={`/jobs/${job.id}/edit`} className="btn-primary">
            <Pencil size={16} /> Edit Job
          </Link>
        </div>
      </div>
      <section className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-orange-900">Kesiapan Job</p>
            <p className="mt-1 text-sm text-orange-800">
              CIPL: {label(details.cipl.status)} · Dokumen BC selesai: {completed}/{required}
            </p>
          </div>
          <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-orange-100">
            <div
              className="h-full rounded-full bg-orange-600"
              style={{ width: `${required ? Math.round((completed / required) * 100) : 0}%` }}
            />
          </div>
        </div>
      </section>
      {!showManifest && (
        <section className="card p-5">
          <h2 className="font-semibold">Exhibitor</h2>
          {job.exhibitor ? (
            <dl className="mt-4 grid gap-5 sm:grid-cols-3">
              <Info label="Exhibitor" value={job.exhibitor.legalName} />
              <Info label="Hall" value={job.exhibitor.logistics?.hall} />
              <Info label="Booth" value={job.exhibitor.logistics?.booth} />
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              Belum ada exhibitor yang ditautkan ke job ini.
            </p>
          )}
        </section>
      )}
      {showManifest && (
        <JobManifestSection
          view={buildManifestView(job, exhibitors)}
          onEditManifest={() => setManifestModalOpen(true)}
          onEditPeserta={setLogisticsTarget}
        />
      )}
      {documentComparison && <DocumentComparisonSummary comparison={documentComparison} />}
      <>
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <section className="card p-5">
              <h2 className="font-semibold">Identitas Job</h2>
              <dl className="mt-4 grid gap-5 sm:grid-cols-2">
                <Info label="Exhibitor" value={job.exhibitor?.legalName || job.clientName} />
                <Info label="Peran dalam shipment" value="Shipper" />
                <Info label="Agent" value={job.agent} />
                <Info label="Consignee" value={job.consignee} />
                <Info label="Notify party" value={job.notifyParty} />
                <Info label="PIC" value={job.assignedTo?.name} />
              </dl>
            </section>
            <section className="card p-5">
              <div className="flex items-center gap-2">
                <ShipWheel size={20} className="text-orange-600" />
                <h2 className="font-semibold">Perjalanan</h2>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {(
                  [
                    ['Masuk', details.inbound],
                    ['Keluar', details.outbound],
                  ] as const
                ).map(([title, leg]) => (
                  <div key={title} className="rounded-xl border border-slate-200 p-4">
                    <p className="font-semibold text-slate-800">{title}</p>
                    <p className="mt-2 text-sm text-slate-600">
                      {leg.mode
                        ? `${leg.mode} · ${leg.documentType || 'tanpa dokumen'}`
                        : 'Belum direncanakan'}
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {leg.documentNumber || 'Nomor dokumen belum diisi'}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">Vessel: {leg.carrier || '—'}</p>
                    <p className="mt-3 text-xs text-slate-500">
                      Jadwal: {date(leg.scheduleAt)} · Aktual: {date(leg.actualAt)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
            <section className="card p-5">
              <div className="flex items-center gap-2">
                <FileText size={20} className="text-orange-600" />
                <h2 className="font-semibold">Dokumen kepabeanan</h2>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {(
                  Object.entries(details.customs) as Array<
                    [keyof typeof details.customs, typeof details.customs.BC_2_3]
                  >
                ).map(([kind, document]) => (
                  <div key={kind} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{label(kind)}</p>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold ${!document.applicable ? 'bg-slate-100 text-slate-500' : document.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}
                      >
                        {document.applicable ? label(document.status) : 'Tidak diperlukan'}
                      </span>
                    </div>
                    {document.applicable && (
                      <dl className="mt-4 space-y-3">
                        <Info label="Nomor aju" value={document.ajuNumber} />
                        <Info label="Nopen" value={document.registrationNumber} />
                        <Info label="Tanggal Nopen" value={date(document.registrationDate)} />
                        <Info label="Gudang" value={document.warehouseName} />
                      </dl>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
          <aside className="space-y-6">
            <section className="card p-5">
              <div className="flex items-center gap-2">
                <CalendarDays size={20} className="text-orange-600" />
                <h2 className="font-semibold">CIPL</h2>
              </div>
              <p className="mt-4 text-sm font-medium text-slate-800">
                {label(details.cipl.status)}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {details.cipl.referenceNumber || 'Referensi belum diisi'}
              </p>
              <p className="mt-4 text-xs text-slate-500">
                Diterima: {date(details.cipl.receivedAt)}
              </p>
            </section>
            <section className="card p-5">
              <h2 className="font-semibold">Details Barang</h2>
              <p className="mt-1 text-xs text-slate-500">
                Diekstrak dari invoice; nanti bersumber dari CIPL.
              </p>
              <p className="mt-3 text-sm font-medium text-slate-800">
                No. Invoice: {details.invoiceNumber || '-'}
              </p>
              {invoiceItems.length ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-500">
                      <tr>
                        <th className="pb-2 pr-3">Barang</th>
                        <th className="pb-2 pr-3">HS</th>
                        <th className="pb-2 text-right">Harga</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceItems.map((item, index) => (
                        <tr key={`${item.description}-${index}`} className="border-t">
                          <td className="py-2 pr-3 text-slate-700">{item.description}</td>
                          <td className="py-2 pr-3 text-slate-600">{item.hsCode || '-'}</td>
                          <td className="py-2 text-right text-slate-700">
                            {item.currency || ''} {item.lineTotal ?? item.unitPrice ?? '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  Belum ada baris barang yang berhasil diekstrak.
                </p>
              )}
            </section>
            <section className="card p-5">
              <h2 className="font-semibold">Remark</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {job.notes || 'Belum ada remark operasional.'}
              </p>
            </section>
          </aside>
        </div>
        <ContextTicketList contextKind="JOB" contextId={job.id} />
      </>
      {manifestModalOpen && (
        <JobManifestEditorModal
          job={job}
          eventId={job.eventId ?? null}
          peserta={buildManifestView(job, exhibitors).peserta}
          onClose={() => setManifestModalOpen(false)}
          onSaved={(savedJob) => {
            setJob(savedJob)
            setManifestModalOpen(false)
          }}
          onPesertaLogisticsSaved={(exhibitorId, logistics) => {
            setExhibitors((current) =>
              current.map((item) => (item.id === exhibitorId ? { ...item, logistics } : item)),
            )
          }}
        />
      )}
      {logisticsTarget && job.eventId && (
        <ExhibitorLogisticsModal
          eventId={job.eventId}
          exhibitor={logisticsTarget}
          onClose={() => setLogisticsTarget(null)}
          onSaved={(exhibitorId, logistics) => {
            setExhibitors((current) =>
              current.map((item) => (item.id === exhibitorId ? { ...item, logistics } : item)),
            )
            setLogisticsTarget(null)
          }}
        />
      )}
    </div>
  )
}
