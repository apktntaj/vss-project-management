'use client'

// Tabel daftar job sederhana untuk /jobs, mengikuti gaya tabel di halaman events: satu baris teks
// per job, tautan ke detail, dan semua aksi (upload, edit dokumen, unduh BC) di menu titik tiga.

import { useState } from 'react'
import Link from 'next/link'
import { Download, ExternalLink, FileText, MoreVertical, Ship, Upload } from 'lucide-react'

import { getOperationalDetails, type Job } from '@/lib/data-client'
import { invoiceStatusLabels, transportModeLabels, type BcDocumentKind } from '@/domain/job/types'
import { jobJenisKey, jobJenisLabel } from '@/lib/job-jenis'
import type { JobListEvent } from '@/lib/job-list'
import { StatusBadge } from '@/components/status-badge'
import type { EditableJobDocument } from '@/components/job-document-editor-dialog'
import { JobUploadDialog } from '@/components/job-upload-dialog'
import { date, label } from '@/components/job-row'

const INVOICE_BADGE: Record<Job['invoice']['status'], string> = {
  NOT_READY: 'bg-slate-100 text-slate-500',
  READY: 'bg-blue-100 text-blue-800',
  SENT: 'bg-amber-100 text-amber-800',
  PAID: 'bg-emerald-100 text-emerald-800',
}

const th = 'sticky top-0 z-10 border-b border-slate-200 bg-white px-3 py-3'

type JobTableProps = {
  jobs: Job[]
  eventById: ReadonlyMap<string, JobListEvent>
  onJobUpdated: (job: Job) => void
  onToast: (message: string, tone?: 'info' | 'error') => void
  onGenerate: (job: Job, documentType: BcDocumentKind) => void
  onEditDocument: (job: Job, kind: EditableJobDocument) => void
}

export function JobTable({ jobs, eventById, ...handlers }: JobTableProps) {
  return (
    <div className="card max-h-[65vh] overflow-auto">
      <table className="w-full min-w-[1000px] table-fixed text-left text-sm">
        <colgroup>
          <col className="w-[44px]" />
          <col className="w-[150px]" />
          <col />
          <col className="w-[190px]" />
          <col className="w-[170px]" />
          <col className="w-[100px]" />
          <col className="w-[110px]" />
          <col className="w-[110px]" />
          <col className="w-[48px]" />
        </colgroup>
        <thead className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          <tr>
            <th className={`${th} px-2 text-right`}>No</th>
            <th className={th}>No Job</th>
            <th className={th}>Event</th>
            <th className={th}>Pihak</th>
            <th className={th}>B/L · AWB</th>
            <th className={th}>ETA</th>
            <th className={th}>Tagihan</th>
            <th className={th}>Status</th>
            <th className={th}>
              <span className="sr-only">Aksi</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job, index) => (
            <JobTableRow
              key={job.id}
              job={job}
              index={index}
              event={eventById.get(job.eventId)}
              {...handlers}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function JobTableRow({
  job,
  index,
  event,
  onJobUpdated,
  onToast,
  onGenerate,
  onEditDocument,
}: Omit<JobTableProps, 'jobs' | 'eventById'> & {
  job: Job
  index: number
  event: JobListEvent | undefined
}) {
  const operational = getOperationalDetails(job)
  const jenis = [
    jobJenisLabel(jobJenisKey(job)),
    job.transportMode ? transportModeLabels[job.transportMode] : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const partyName = job.party?.name ?? null
  const partyKind = job.party?.kind === 'AGENT' ? 'Agent' : job.party?.kind === 'EXHIBITOR' ? 'Exhibitor' : null

  return (
    <tr className="border-b border-slate-100 odd:bg-slate-50/70 last:border-0 hover:bg-orange-50/40">
      <td className="px-2 py-3 text-right align-top tabular-nums text-slate-400">{index + 1}</td>
      <td className="px-3 py-3 align-top">
        <Link
          href={`/jobs/${job.id}`}
          className="block truncate font-semibold text-slate-600 hover:text-orange-700"
          title={job.jobNumber ?? job.vssNumber}
        >
          {job.jobNumber ?? 'Belum bernomor'}
        </Link>
        <p className="mt-0.5 text-xs text-slate-400">{job.vssNumber}</p>
      </td>
      <td className="px-3 py-3 align-top">
        {event ? (
          <Link
            href={`/events/${event.id}`}
            className="block truncate text-slate-500 hover:text-orange-700"
            title={event.name}
          >
            {event.name}
          </Link>
        ) : (
          <p className="text-slate-300">—</p>
        )}
        <p className="mt-0.5 truncate text-xs text-slate-400">{jenis}</p>
      </td>
      <td className="px-3 py-3 align-top">
        <p className="truncate text-slate-500" title={partyName ?? undefined}>
          {partyName ?? <span className="text-slate-300">Belum ditetapkan</span>}
        </p>
        {partyKind ? <p className="mt-0.5 text-xs text-slate-400">{partyKind}</p> : null}
      </td>
      <td className="px-3 py-3 align-top">
        {job.transportDocumentNumber ? (
          <p className="truncate text-slate-500" title={job.transportDocumentNumber}>
            {job.transportDocumentNumber}
          </p>
        ) : (
          <p className="text-slate-300">Belum ada</p>
        )}
        {job.transportDocumentType ? (
          <p className="mt-0.5 text-xs text-slate-400">{job.transportDocumentType === 'AWB' ? 'AWB' : 'B/L'}</p>
        ) : null}
      </td>
      <td className="px-3 py-3 align-top text-slate-500">
        {operational.inbound.scheduleAt ? date(operational.inbound.scheduleAt) : <span className="text-slate-300">—</span>}
      </td>
      <td className="px-3 py-3 align-top">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${INVOICE_BADGE[job.invoice.status]}`}
        >
          {invoiceStatusLabels[job.invoice.status]}
        </span>
      </td>
      <td className="px-3 py-3 align-top">
        <StatusBadge status={job.status} />
      </td>
      <td className="px-3 py-3 text-right align-top">
        <JobRowMenu
          job={job}
          onJobUpdated={onJobUpdated}
          onToast={onToast}
          onGenerate={onGenerate}
          onEditDocument={onEditDocument}
        />
      </td>
    </tr>
  )
}

function JobRowMenu({
  job,
  onJobUpdated,
  onToast,
  onGenerate,
  onEditDocument,
}: Omit<JobTableProps, 'jobs' | 'eventById'> & { job: Job }) {
  // Menu di-anchor fixed dari getBoundingClientRect agar tidak terpotong wadah tabel yang overflow.
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number } | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const customs = getOperationalDetails(job).customs
  const applicableBc = (Object.keys(customs) as BcDocumentKind[]).filter((key) => customs[key].applicable)
  const name = job.jobNumber ?? job.vssNumber

  const item = 'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50'
  const run = (action: () => void) => () => {
    setMenuAnchor(null)
    action()
  }

  return (
    <>
      <button
        type="button"
        onClick={(clickEvent) => {
          const rect = clickEvent.currentTarget.getBoundingClientRect()
          setMenuAnchor((current) => (current ? null : { top: rect.bottom + 4, left: rect.right - 208 }))
        }}
        aria-label={`Menu aksi untuk ${name}`}
        aria-expanded={menuAnchor !== null}
        aria-haspopup="menu"
        className="rounded-lg p-2 text-slate-500 hover:bg-orange-50 hover:text-orange-700"
      >
        <MoreVertical size={18} />
      </button>
      {menuAnchor && (
        <>
          <div className="fixed inset-0 z-40" role="presentation" onClick={() => setMenuAnchor(null)} />
          <div
            role="menu"
            aria-label={`Aksi untuk ${name}`}
            className="fixed z-50 w-52 overflow-hidden rounded-xl border border-black/10 bg-white py-1 shadow-lg"
            style={{ top: menuAnchor.top, left: menuAnchor.left }}
          >
            <Link role="menuitem" href={`/jobs/${job.id}`} className={item}>
              <ExternalLink size={15} /> Buka detail
            </Link>
            <button role="menuitem" type="button" className={item} onClick={run(() => setUploadOpen(true))}>
              <Upload size={15} /> Upload dokumen
            </button>
            <button role="menuitem" type="button" className={item} onClick={run(() => onEditDocument(job, 'TRANSPORT'))}>
              <Ship size={15} /> Edit B/L · AWB
            </button>
            <button role="menuitem" type="button" className={item} onClick={run(() => onEditDocument(job, 'INVOICE'))}>
              <FileText size={15} /> Edit invoice
            </button>
            {applicableBc.length ? <div className="my-1 border-t border-slate-100" /> : null}
            {applicableBc.map((key) => (
              <button key={key} role="menuitem" type="button" className={item} onClick={run(() => onGenerate(job, key))}>
                <Download size={15} /> Unduh {label(key)}
              </button>
            ))}
          </div>
        </>
      )}
      <JobUploadDialog job={job} open={uploadOpen} onOpenChange={setUploadOpen} onJobUpdated={onJobUpdated} onToast={onToast} />
    </>
  )
}
