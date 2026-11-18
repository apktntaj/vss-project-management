'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  FileSpreadsheet,
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
  listJobSummaries,
  type Exhibitor,
  type Job,
  type JobSummary,
} from '@/lib/data-client'
import { bcDocumentLabels, type BcDocumentKind } from '@/domain/job/types'
import { jobStageLabel, stageCustomsDocument } from '@/domain/job/regime'
import { stageCiplLines, withStageGoods } from '@/domain/job/stages'
import { summarizeKoliCollections } from '@/domain/job/manifest'
import { buildManifestView } from '@/lib/manifest-view'
import { totalDokumen } from '@/domain/exhibition/cipl-document'
import { ActionMenu, type ActionMenuItem } from '@/components/action-menu'
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
import { JobStageCard } from '@/components/job-stage-card'
import { JobCustomsCard } from '@/components/job-customs-card'
import { JobCustomsPendingCard } from '@/components/job-customs-pending-card'
import { JobDeadlineBanner } from '@/components/job-deadline-banner'
import { JobLartasCard } from '@/components/job-lartas-card'
import { JobBillingDialog, JobPartyInvoiceCard } from '@/components/job-party-invoice-card'
import { JobContextBadge } from '@/components/job-context-badge'
import { JobDetailSkeleton } from '@/components/loading-skeletons'
import { JobReadinessBar } from '@/components/job-readiness-bar'
import { JobNotesPanel } from '@/components/job-notes-card'
import { CancelJobDialog } from '@/components/cancel-job-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { date, downloadCustomsWorkbook, label } from '@/components/job-row'
import { jobContext } from '@/lib/job-context'
import { notify } from '@/lib/notify'
import { jobLabel, jobNumberLabel } from '@/domain/job/numbering'
import { hasTabData, tabActionLabel } from '@/domain/job/tab-data'
import type { JobDetailTab, JobReadinessTarget } from '@/lib/job-readiness'
import { StatusBadge } from '@/components/status-badge'

// Sementara disembunyikan dari tab Muatan atas permintaan; kartu, komponen, dan alurnya tetap ada.
const SHOW_MUATAN_EXTRAS = false

// Jenis lampiran yang ditampilkan per tab. BC_* dan OTHER belum punya tempat di halaman ini.
const MUATAN_DOCUMENT_KINDS = ['CIPL', 'PACKING_LIST', 'COMMERCIAL_INVOICE', 'SOURCE'] as const
const CUSTOMS_DOCUMENT_KINDS = ['BC_2_0', 'BC_2_3', 'BC_2_5', 'BC_3_0', 'BC_2_7'] as const
const TRANSPORT_DOCUMENT_KINDS = [
  'BILL_OF_LADING',
  'AIR_WAYBILL',
  'INBOUND_TRANSPORT',
  'OUTBOUND_TRANSPORT',
] as const

/** Package yang seluruh isinya disposal; aturan pembagian baris CIPL per tahap ada di domain/job/stages. */
const disposedPackageCount = (job: Job) =>
  summarizeKoliCollections(stageCiplLines(job.ciplLines, 'DISPOSAL').map((line) => line.koli)).totalCount

// Adaptor untuk komponen anak yang memakai nada 'info'/'error'; semua toast lewat `notify` bersama.
const toast = (message: string, tone: 'info' | 'error' = 'info') =>
  notify(message, tone === 'error' ? 'error' : 'success')

const TAB_VALUES: ReadonlyArray<JobDetailTab> = ['muatan', 'pabean', 'transport', 'billing']

const emptyTabIcons = {
  muatan: PackageOpen,
  pabean: FileSpreadsheet,
  transport: Ship,
  billing: ReceiptText,
} satisfies Record<JobDetailTab, LucideIcon>

function EmptyTabState({ tab }: { tab: JobDetailTab }) {
  const Icon = emptyTabIcons[tab]
  return (
    <section className="card flex flex-col items-center px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-slate-600 ring-8 ring-orange-50/60">
        <Icon size={26} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="mt-4 text-sm font-medium text-slate-600">Belum ada data</p>
    </section>
  )
}

export default function JobDetail({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notFound, setNotFound] = useState(false)
  // Setiap pemuatan (awal atau "Coba lagi") diberi nomor; hasil pemuatan yang sudah usang diabaikan.
  const loadSeq = useRef(0)
  const loadJob = useCallback(() => {
    const seq = ++loadSeq.current
    setLoading(true)
    setLoadError('')
    setNotFound(false)
    getJob(params.id)
      .then((loadedJob) => {
        if (seq !== loadSeq.current) return
        setJob(loadedJob)
        setNotFound(!loadedJob)
      })
      .catch((caught) => {
        if (seq !== loadSeq.current) return
        setLoadError(caught instanceof Error ? caught.message : 'Job tidak dapat dimuat.')
      })
      .finally(() => {
        if (seq === loadSeq.current) setLoading(false)
      })
  }, [params.id])
  useEffect(() => {
    loadJob()
    return () => {
      loadSeq.current += 1
    }
  }, [loadJob])
  const [exhibitors, setExhibitors] = useState<Exhibitor[]>([])
  // Rangkaian job BC (job masuk + turunannya) untuk kartu rangkaian; dimuat ulang saat job berubah
  // atau setelah job turunan baru dibuat manual dari kartu.
  const [sourceJob, setSourceJob] = useState<Job | null>(null)
  const [series, setSeries] = useState<JobSummary[]>([])
  const [seriesRefresh, setSeriesRefresh] = useState(0)
  const [ciplEntryOpen, setCiplEntryOpen] = useState(false)
  // Dialog dokumen sumber yang sedang diedit: INVOICE (tab CIPL) atau TRANSPORT (tab Transport).
  const [documentEdit, setDocumentEdit] = useState<EditableJobDocument | null>(null)
  const [billingOpen, setBillingOpen] = useState(false)
  const [headerOpen, setHeaderOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  // Tab area kerja aktif disimpan di URL (?tab=muatan|pabean|transport|billing) agar bisa dibagikan
  // dan bertahan refresh; dibaca sekali saat mount (pola ?newJob=1 di halaman event). Tanpa
  // ?tab=, job bertahap (BC/Carnet) membuka tab Pabean, selebihnya CIPL.
  const [requestedTab, setRequestedTab] = useState<JobDetailTab | null>(null)
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('tab')
    const requested = TAB_VALUES.find((value) => value === fromUrl)
    if (requested) setRequestedTab(requested)
  }, [])
  const hasPabeanTab =
    job != null && job.stage != null && stageCustomsDocument(job.internationalJenis, job.stage) != null
  const defaultTab: JobDetailTab = hasPabeanTab ? 'pabean' : 'muatan'
  const tab: JobDetailTab =
    requestedTab && (requestedTab !== 'pabean' || hasPabeanTab) ? requestedTab : defaultTab
  function selectTab(next: JobDetailTab) {
    setRequestedTab(next)
    window.history.replaceState(
      null,
      '',
      next === defaultTab ? `/jobs/${params.id}` : `/jobs/${params.id}?tab=${next}`,
    )
  }
  // Header job bukan tab: langkah kesiapan "No Job" membuka dialog ubah header. Job tanpa tab
  // Pabean (Local/Road) mengalihkan langkah "Dokumen pabean" ke Transport.
  function navigateReadiness(target: JobReadinessTarget) {
    if (target === 'header') {
      if (job?.status !== 'CANCELLED') setHeaderOpen(true)
    } else selectTab(target === 'pabean' && !hasPabeanTab ? 'transport' : target)
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
  function openTabEditor() {
    if (tab === 'pabean') return
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

  // Rangkaian job BC: job masuk (sumber barang CIPL) + daftar job turunan aktif satu kiriman.
  // Hanya untuk job bertahap; Local/Road tidak punya rangkaian.
  const jobId = job?.id
  const jobStage = job?.stage ?? null
  useEffect(() => {
    if (!jobId || !jobStage) {
      setSourceJob(null)
      setSeries([])
      return
    }
    let active = true
    const current = job
    const rootId = current.sourceJobId ?? jobId
    Promise.all([
      current.sourceJobId ? getJob(current.sourceJobId) : Promise.resolve(current),
      listJobSummaries({ eventId: current.eventId }),
    ])
      .then(([source, summaries]) => {
        if (!active) return
        setSourceJob(source)
        setSeries(
          summaries.filter(
            (summary) => summary.sourceJobId === rootId && summary.status !== 'CANCELLED',
          ),
        )
      })
      .catch((caught) => {
        if (!active) return
        setSeries([])
        toast(
          caught instanceof Error ? caught.message : 'Rangkaian job tidak dapat dimuat.',
          'error',
        )
      })
    return () => {
      active = false
    }
  }, [jobId, job?.version, jobStage, seriesRefresh])
  if (loading) return <JobDetailSkeleton />
  if (loadError)
    return (
      <div className="card mx-auto max-w-xl p-8 text-center" role="alert">
        <AlertTriangle className="mx-auto text-rose-500" size={28} aria-hidden="true" />
        <h1 className="mt-3 text-xl font-bold">Job gagal dimuat</h1>
        <p className="mt-2 text-sm text-slate-600">{loadError}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" onClick={loadJob} className="btn-primary">
            Coba lagi
          </button>
          <Link href="/jobs" className="btn-secondary">
            Kembali ke Jobs
          </Link>
        </div>
      </div>
    )
  if (!job || notFound)
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <h1 className="text-xl font-bold">Job tidak ditemukan</h1>
        <p className="mt-2 text-sm text-slate-600">
          Job ini tidak ada atau Anda tidak punya akses ke job tersebut.
        </p>
        <Link href="/jobs" className="btn-primary mt-6">
          Kembali ke Jobs
        </Link>
      </div>
    )
  const isEvent = context?.kind === 'EVENT'
  const cancelled = job.status === 'CANCELLED'
  const details = getOperationalDetails(job)
  const stageDocument =
    job.stage != null ? stageCustomsDocument(job.internationalJenis, job.stage) : null
  // Workbook BUP hanya untuk dokumen BC yang punya template (BC 2.3/2.5/3.0) — bukan Carnet/BC 2.0.
  const workbookKind = (['BC_2_3', 'BC_2_5', 'BC_3_0'] as const).find(
    (kind) => kind === stageDocument,
  )
  const invoiceItems = details.invoiceItems ?? []
  const tabItems: ReadonlyArray<readonly [JobDetailTab, string]> = [
    ['muatan', 'CIPL'],
    ...(hasPabeanTab ? ([['pabean', 'Pabean']] as const) : []),
    ['transport', 'Transport'],
    ['billing', 'Billing'],
  ]
  // Tombol di ujung tab membuka form sesuai tab aktif. Tab Pabean memakai form inline di kartunya.
  const showTabAction =
    !cancelled && tab !== 'pabean' && (!job.sourceJobId || tab === 'billing')
  const hasTransportDocument = Boolean(job.transportDocument || job.transportDocumentNumber)
  const tabActionText =
    tab === 'transport'
      ? `${hasTransportDocument ? 'Edit' : 'Buat'} B/L-AWB`
      : tab === 'pabean'
        ? ''
        : tabActionLabel(tab, job)
  const jobMenuItems: ActionMenuItem[] = [
    ...(workbookKind
      ? [
          {
            key: 'workbook',
            label: `Export workbook ${bcDocumentLabels[workbookKind]}`,
            icon: FileSpreadsheet,
            onSelect: () => void exportWorkbook(workbookKind),
          },
        ]
      : []),
    cancelled
      ? {
          key: 'cancelled',
          label: 'Job sudah dibatalkan',
          icon: Ban,
          disabled: true,
          separatorBefore: Boolean(workbookKind),
          onSelect: () => undefined,
        }
      : {
          key: 'cancel',
          label: 'Batalkan job',
          icon: Ban,
          tone: 'danger',
          separatorBefore: Boolean(workbookKind),
          onSelect: () => setCancelOpen(true),
        },
  ]
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/jobs"
            className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={16} aria-hidden="true" /> Kembali ke Jobs
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1
              className={`text-3xl font-bold tracking-tight ${job.jobNumber ? '' : 'text-slate-500'}`}
            >
              {job.jobNumber || job.manifestPrefix ? jobNumberLabel(job) : 'No Job belum ada'}
            </h1>
            <StatusBadge status={job.status} />
            {job.stage && (
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                {jobStageLabel(job.internationalJenis, job.stage)}
              </span>
            )}
          </div>
          <dl className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-1.5">
              <dt className="text-slate-600">Jenis</dt>
              <dd>
                <JobContextBadge job={job} />
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="text-slate-600">Agent</dt>
              <dd className="font-medium text-slate-900">
                {job.party?.kind === 'AGENT' ? job.party.name : '—'}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="text-slate-600">ETA</dt>
              <dd className="font-medium text-slate-900">{date(details.inbound.scheduleAt)}</dd>
            </div>
          </dl>
        </div>
        <div className="flex items-center gap-2">
          {!cancelled && (
            <button
              type="button"
              onClick={() => setHeaderOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
            >
              <Pencil size={14} aria-hidden="true" /> Ubah header
            </button>
          )}
          <ActionMenu label="Menu aksi job" items={jobMenuItems} width={224} bordered />
        </div>
      </header>
      <JobDeadlineBanner
        job={job}
        source={job.sourceJobId ? sourceJob : null}
        onOpenPabean={() => selectTab('pabean')}
      />
      {cancelled && (
        <section
          className="card flex items-start gap-3 border-rose-200 bg-rose-50/60 p-5"
          role="status"
        >
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
            <p className="mt-1 text-xs text-slate-600">Job ini tidak dapat diubah lagi.</p>
          </div>
        </section>
      )}
      <div className="grid items-start gap-4 md:grid-cols-2">
        <JobReadinessBar job={job} activeTab={tab} onNavigate={navigateReadiness} />
        <JobNotesPanel job={job} onSaved={setJob} />
      </div>
      {job.stage && (
        <JobStageCard
          job={job}
          sourceJob={sourceJob}
          series={series}
          onCreated={() => setSeriesRefresh((value) => value + 1)}
        />
      )}
      <Tabs value={tab} onValueChange={(value) => selectTab(value as JobDetailTab)}>
        <div className="sticky top-0 z-30 -mx-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b bg-background px-1 py-2">
          <TabsList className="h-auto max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {tabItems.map(([value, text]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="h-auto min-h-9 rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 data-[active]:bg-orange-600 data-[active]:text-white data-[active]:shadow-sm data-[active]:hover:bg-orange-600 data-[active]:hover:text-white sm:px-4"
              >
                {text}
              </TabsTrigger>
            ))}
          </TabsList>
          {showTabAction && (
            <button
              type="button"
              onClick={openTabEditor}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
            >
              <Pencil size={14} aria-hidden="true" /> {tabActionText}
            </button>
          )}
        </div>
        <TabsContent value="muatan" className="space-y-6">
          {job.sourceJobId ? (
            // Job turunan: barang selalu diturunkan dari baris CIPL job masuk (baca-saja).
            (() => {
              const viewJob = withStageGoods(job, sourceJob)
              if (viewJob.ciplLines.length === 0) return <EmptyTabState tab="muatan" />
              return (
                <>
                  {isEvent && (
                    <JobManifestSection
                      view={buildManifestView(viewJob)}
                      invoiceNumber={sourceJob?.commercialInvoiceNumber ?? null}
                      totalAmount={null}
                      disposedPackages={disposedPackageCount(viewJob)}
                    />
                  )}
                  <JobBarangCard job={viewJob} onToast={toast} />
                </>
              )
            })()
          ) : hasTabData('muatan', job) ? (
            <>
              {isEvent && (
                <JobManifestSection
                  view={buildManifestView(job)}
                  invoiceNumber={job.commercialInvoiceNumber || job.ciplDocument?.nomor || null}
                  totalAmount={job.ciplDocument ? totalDokumen(job.ciplDocument).nilaiTotal : null}
                  disposedPackages={disposedPackageCount(job)}
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
          {!job.sourceJobId && <JobDocumentsCard job={job} kinds={MUATAN_DOCUMENT_KINDS} />}
        </TabsContent>
        {hasPabeanTab && stageDocument && job.stage && (
          <TabsContent value="pabean" className="space-y-6">
            <JobCustomsCard job={job} source={sourceJob} onSaved={setJob} />
            <JobDocumentsCard job={job} kinds={CUSTOMS_DOCUMENT_KINDS} title="Lampiran pabean" />
            <JobCustomsPendingCard
              kind={stageDocument}
              stage={job.stage}
              jenis={job.internationalJenis}
            />
          </TabsContent>
        )}
        <TabsContent value="transport" className="space-y-6">
          {job.sourceJobId ? (
            <section className="card p-5">
              <h2 className="font-semibold">Transport</h2>
              <p className="mt-1 text-sm text-slate-600">
                Dokumen angkut (B/L atau AWB) mengikuti job masuk.
                {sourceJob && (
                  <>
                    {' '}
                    <Link
                      href={`/jobs/${sourceJob.id}?tab=transport`}
                      className="font-medium text-foreground underline underline-offset-2"
                    >
                      Buka job masuk {jobNumberLabel(sourceJob)}
                    </Link>
                    .
                  </>
                )}
              </p>
            </section>
          ) : (
            <>
              <JobTransportDocumentCard job={job} />
              <JobDocumentsCard job={job} kinds={TRANSPORT_DOCUMENT_KINDS} />
            </>
          )}
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
