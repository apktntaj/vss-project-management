'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Ban,
  FileSpreadsheet,
  MoreVertical,
  Pencil,
  PackageOpen,
  ReceiptText,
  Ship,
  type LucideIcon,
} from 'lucide-react'
import {
  getJob,
  getOperationalDetails,
  listEventExhibitors,
  type Exhibitor,
  type Job,
} from '@/lib/data-client'
import { bcDocumentLabels, type BcDocumentKind } from '@/domain/job/types'
import { buildManifestView } from '@/lib/manifest-view'
import { totalDokumen } from '@/domain/exhibition/cipl-document'
import { JobHeaderDialog } from '@/components/job-detail-cards'
import { JobManifestSection } from '@/components/job-manifest-section'
import { JobBarangCard } from '@/components/job-barang-card'
import { CiplEntryModal } from '@/components/cipl-entry-modal'
import {
  JobDocumentEditorDialog,
  type EditableJobDocument,
} from '@/components/job-document-editor-dialog'
import { JobTransportDocumentCard } from '@/components/job-transport-document-card'
import { JobDocumentsCard } from '@/components/job-documents-card'
import { JobLartasCard } from '@/components/job-lartas-card'
import { JobBillingDialog, JobPartyInvoiceCard } from '@/components/job-party-invoice-card'
import { JobContextBadge } from '@/components/job-context-badge'
import { JobDetailSkeleton } from '@/components/loading-skeletons'
import { JobReadinessBar } from '@/components/job-readiness-bar'
import { JobNotesCard } from '@/components/job-notes-card'
import { CancelJobDialog } from '@/components/cancel-job-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { date, downloadCustomsWorkbook, label } from '@/components/job-row'
import { jobContext } from '@/lib/job-context'
import { jobLabel } from '@/domain/job/numbering'
import { hasTabData, tabActionLabel } from '@/domain/job/tab-data'
import type { JobDetailTab, JobReadinessTarget } from '@/lib/job-readiness'
import { StatusBadge } from '@/components/status-badge'

// Sementara disembunyikan dari tab Muatan atas permintaan; kartu, komponen, dan alurnya tetap ada.
const SHOW_MUATAN_EXTRAS = false

// Jenis lampiran yang ditampilkan per tab. BC_* dan OTHER belum punya tempat di halaman ini.
const MUATAN_DOCUMENT_KINDS = ['CIPL', 'PACKING_LIST', 'COMMERCIAL_INVOICE', 'SOURCE'] as const
const TRANSPORT_DOCUMENT_KINDS = ['BILL_OF_LADING', 'AIR_WAYBILL', 'INBOUND_TRANSPORT', 'OUTBOUND_TRANSPORT'] as const

const toast = (message: string, tone: 'info' | 'error' = 'info') =>
  window.dispatchEvent(
    new CustomEvent('vss:toast', {
      detail: { message, tone: tone === 'error' ? 'error' : 'success' },
    }),
  )

const emptyTabIcons = {
  muatan: PackageOpen,
  transport: Ship,
  billing: ReceiptText,
} satisfies Record<JobDetailTab, LucideIcon>

function EmptyTabState({ tab }: { tab: JobDetailTab }) {
  const Icon = emptyTabIcons[tab]
  return (
    <section className="card flex flex-col items-center px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 ring-8 ring-orange-50/60">
        <Icon size={26} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="mt-4 text-sm font-medium text-slate-500">Belum ada data</p>
    </section>
  )
}

export default function JobDetail({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  useEffect(() => {
    let active = true
    setLoading(true)
    getJob(params.id)
      .then((loadedJob) => {
        if (!active) return
        setJob(loadedJob)
        setLoadError(loadedJob ? '' : 'Job tidak ditemukan.')
        setLoading(false)
      })
      .catch((caught) => {
        if (!active) return
        setLoadError(caught instanceof Error ? caught.message : 'Job tidak dapat dimuat.')
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [params.id])
  const [exhibitors, setExhibitors] = useState<Exhibitor[]>([])
  const [ciplEntryOpen, setCiplEntryOpen] = useState(false)
  // Dialog dokumen sumber yang sedang diedit: INVOICE (tab CIPL) atau TRANSPORT (tab Transport).
  const [documentEdit, setDocumentEdit] = useState<EditableJobDocument | null>(null)
  const [billingOpen, setBillingOpen] = useState(false)
  const [headerOpen, setHeaderOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number } | null>(null)

  // Tab area kerja aktif disimpan di URL (?tab=muatan|transport|billing) agar bisa dibagikan dan
  // bertahan refresh; dibaca sekali saat mount (pola ?newJob=1 di halaman event).
  const [tab, setTab] = useState<JobDetailTab>('muatan')
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('tab')
    if (fromUrl === 'muatan' || fromUrl === 'transport' || fromUrl === 'billing') setTab(fromUrl)
  }, [])
  function selectTab(next: JobDetailTab) {
    setTab(next)
    window.history.replaceState(
      null,
      '',
      next === 'muatan' ? `/jobs/${params.id}` : `/jobs/${params.id}?tab=${next}`,
    )
  }
  // Header job bukan tab: langkah kesiapan "No Job" membuka dialog ubah header.
  function navigateReadiness(target: JobReadinessTarget) {
    if (target === 'header') {
      if (job?.status !== 'CANCELLED') setHeaderOpen(true)
    } else selectTab(target)
  }

  async function exportWorkbook(kind: BcDocumentKind) {
    if (!job) return
    try {
      await downloadCustomsWorkbook(job, kind)
      toast(`${label(kind)} berhasil diunduh.`)
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'File BC tidak dapat dibuat.', 'error')
    }
  }

  const context = job ? jobContext(job) : null
  // Tombol di ujung tab membuka form sesuai tab aktif.
  function openTabEditor() {
    if (tab === 'billing') setBillingOpen(true)
    else if (tab === 'transport') setDocumentEdit('TRANSPORT')
    else setCiplEntryOpen(true)
  }
  const eventId = context?.kind === 'EVENT' ? context.eventId : null
  // Exhibitor event: pilihan pihak & penautan baris CIPL. Dimuat ulang saat versi job berubah
  // karena menyimpan baris CIPL bisa mendaftarkan exhibitor baru. Hanya untuk konteks EVENT.
  const jobVersion = job?.version ?? 0
  useEffect(() => {
    if (!eventId) {
      setExhibitors([])
      return
    }
    let active = true
    listEventExhibitors(eventId)
      .then((rows) => {
        if (active) setExhibitors(rows)
      })
      .catch(() => {
        if (active) setExhibitors([])
      })
    return () => {
      active = false
    }
  }, [eventId, jobVersion])
  if (loading || !job) {
    if (loadError)
      return (
        <div
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
          role="alert"
        >
          <p>{loadError}</p>
          <Link href="/jobs" className="btn-secondary mt-3 inline-block">
            Kembali ke Jobs
          </Link>
        </div>
      )
    return <JobDetailSkeleton />
  }
  const isEvent = context?.kind === 'EVENT'
  const cancelled = job.status === 'CANCELLED'
  const details = getOperationalDetails(job)
  const invoiceItems = details.invoiceItems ?? []
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
            <h1
              className={`text-4xl font-bold tracking-tight ${job.jobNumber ? '' : 'text-slate-400'}`}
            >
              {job.jobNumber ??
                (job.manifestPrefix ? `${job.manifestPrefix}.-` : 'No Job belum ada')}
            </h1>
            <StatusBadge status={job.status} />
          </div>
          <dl className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-1.5">
              <dd>
                <JobContextBadge job={job} />
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dd className="font-medium text-slate-800">
                {job.party?.kind === 'AGENT' ? job.party.name : '—'}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="text-slate-400">ETA</dt>
              <dd className="font-medium text-slate-800">{date(details.inbound.scheduleAt)}</dd>
            </div>
          </dl>
        </div>
        <div className="relative flex items-center gap-2">
          {!cancelled && (
            <button
              type="button"
              onClick={() => setHeaderOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-orange-50 hover:text-orange-700"
            >
              <Pencil size={14} aria-hidden="true" /> Ubah header
            </button>
          )}
          <button
            type="button"
            onClick={(clickEvent) => {
              const rect = clickEvent.currentTarget.getBoundingClientRect()
              setMenuAnchor((current) =>
                current ? null : { top: rect.bottom + 4, left: rect.right - 208 },
              )
            }}
            aria-label="Menu aksi job"
            aria-expanded={menuAnchor !== null}
            aria-haspopup="menu"
            title="Menu aksi"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-orange-50 hover:text-orange-700"
          >
            <MoreVertical size={18} />
          </button>
          {menuAnchor && (
            <>
              <div
                className="fixed inset-0 z-40"
                role="presentation"
                onClick={() => setMenuAnchor(null)}
              />
              <div
                role="menu"
                aria-label="Aksi job"
                className="fixed z-50 w-52 overflow-hidden rounded-xl border border-black/10 bg-white py-1 shadow-lg"
                style={{ top: menuAnchor.top, left: menuAnchor.left }}
              >
                {job.kind === 'INTERNATIONAL' && (
                  <>
                    {(['BC_2_3', 'BC_2_5', 'BC_3_0', 'BC_2_7'] as const).map((kind) => (
                      <button
                        key={kind}
                        role="menuitem"
                        type="button"
                        onClick={() => {
                          setMenuAnchor(null)
                          void exportWorkbook(kind)
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <FileSpreadsheet size={15} /> Export workbook {bcDocumentLabels[kind]}
                      </button>
                    ))}
                    <div className="my-1 border-t border-black/10" />
                  </>
                )}
                {cancelled ? (
                  <p className="px-3 py-2 text-sm text-slate-400">Job sudah dibatalkan</p>
                ) : (
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setMenuAnchor(null)
                      setCancelOpen(true)
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                  >
                    <Ban size={15} /> Batalkan job
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {cancelled && (
        <section className="card flex items-start gap-3 border-rose-200 bg-rose-50/60 p-5" role="status">
          <Ban size={20} className="mt-0.5 shrink-0 text-rose-600" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-semibold text-rose-800">
              Job dibatalkan{job.cancellation ? ` pada ${date(job.cancellation.cancelledAt)}` : ''}
            </p>
            {job.cancellation && (
              <p className="mt-1 text-sm whitespace-pre-wrap text-slate-700">
                Alasan: {job.cancellation.reason}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-500">Job ini tidak dapat diubah lagi.</p>
          </div>
        </section>
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <JobReadinessBar job={job} activeTab={tab} onNavigate={navigateReadiness} />
        <JobNotesCard job={job} onSaved={setJob} />
      </div>
      <Tabs value={tab} onValueChange={(value) => selectTab(value as JobDetailTab)}>
        <div className="sticky top-0 z-30 -mx-1 flex items-center justify-between gap-3 border-b bg-white/95 px-1 py-2 backdrop-blur">
          <TabsList className="h-auto gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {(
              [
                ['muatan', 'CIPL'],
                ['transport', 'Transport'],
                ['billing', 'Billing'],
              ] as const
            ).map(([value, text]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="h-auto rounded-lg px-4 py-1.5 text-slate-500 hover:bg-orange-50 hover:text-orange-700 data-active:bg-orange-600 data-active:text-white data-active:shadow-sm"
              >
                {text}
              </TabsTrigger>
            ))}
          </TabsList>
          {!cancelled && (
            <button
              type="button"
              onClick={openTabEditor}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-orange-50 hover:text-orange-700"
            >
              <Pencil size={14} aria-hidden="true" /> {tabActionLabel(tab, job)}
            </button>
          )}
        </div>
        <TabsContent value="muatan" className="space-y-6">
          {hasTabData('muatan', job) ? (
            <>
              {isEvent && (
                <JobManifestSection
                  view={buildManifestView(job)}
                  invoiceNumber={job.commercialInvoiceNumber || job.ciplDocument?.nomor || null}
                  totalAmount={job.ciplDocument ? totalDokumen(job.ciplDocument).nilaiTotal : null}
                />
              )}
              {job.ciplLines.length > 0 && <JobBarangCard job={job} onToast={toast} />}
              {SHOW_MUATAN_EXTRAS && job.kind !== 'LOCAL' && (
                <JobLartasCard job={job} onToast={toast} />
              )}
              {SHOW_MUATAN_EXTRAS && (
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
              )}
            </>
          ) : (
            <EmptyTabState tab="muatan" />
          )}
          <JobDocumentsCard job={job} kinds={MUATAN_DOCUMENT_KINDS} />
        </TabsContent>
        <TabsContent value="transport" className="space-y-6">
          <JobTransportDocumentCard job={job} />
          <JobDocumentsCard job={job} kinds={TRANSPORT_DOCUMENT_KINDS} />
        </TabsContent>
        <TabsContent value="billing">
          {hasTabData('billing', job) ? (
            <JobPartyInvoiceCard
              job={job}
              exhibitors={isEvent ? exhibitors : null}
              onSaved={setJob}
            />
          ) : (
            <EmptyTabState tab="billing" />
          )}
        </TabsContent>
      </Tabs>
      {ciplEntryOpen && (
        <CiplEntryModal
          job={job}
          eventExhibitors={exhibitors}
          onSaved={(savedJob) => {
            setJob(savedJob)
            setCiplEntryOpen(false)
          }}
          onClose={() => setCiplEntryOpen(false)}
        />
      )}
      <JobDocumentEditorDialog
        job={job}
        kind={documentEdit ?? 'TRANSPORT'}
        open={documentEdit !== null}
        onOpenChange={(open) => {
          if (!open) setDocumentEdit(null)
        }}
        onSaved={setJob}
        onToast={toast}
      />
      <JobBillingDialog
        job={job}
        exhibitors={isEvent ? exhibitors : null}
        open={billingOpen}
        onClose={() => setBillingOpen(false)}
        onSaved={setJob}
      />
      <JobHeaderDialog
        job={job}
        open={headerOpen}
        onClose={() => setHeaderOpen(false)}
        onSaved={setJob}
      />
      <CancelJobDialog
        job={job}
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onCancelled={(saved) => {
          setJob(saved)
          setCancelOpen(false)
          toast(`Job ${jobLabel(saved)} dibatalkan.`)
        }}
      />
    </div>
  )
}
