'use client'

// Tabel daftar job sederhana untuk /jobs, mengikuti gaya tabel di halaman events: satu baris teks
// per job, tautan ke detail, dan aksi unduh BC di menu titik tiga.

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from 'lucide-react'

import { type Job, getOperationalDetails } from '@/lib/data-client'
import { invoiceStatusLabels, type BcDocumentKind } from '@/domain/job/types'
import { ciplStatusText, deriveCiplStatus, type CiplStatus } from '@/domain/job/cipl-status'
import { ActionMenu } from '@/components/action-menu'
import { JobContextBadge } from '@/components/job-context-badge'
import { date, label } from '@/components/job-row'
import { jobLabel, jobNumberLabel } from '@/domain/job/numbering'
import { jobStageLabel } from '@/domain/job/regime'
import { jobEta, nextJobSort, type JobSortKey, type JobTableSort } from '@/lib/job-list'

const INVOICE_BADGE: Record<Job['invoice']['status'], string> = {
  NOT_READY: 'bg-slate-100 text-slate-600',
  READY: 'bg-blue-100 text-blue-800',
  SENT: 'bg-amber-100 text-amber-800',
  PAID: 'bg-emerald-100 text-emerald-800',
}

const CIPL_BADGE: Record<CiplStatus, { text: string; className: string }> = {
  MISSING: { text: 'Menunggu', className: 'bg-slate-100 text-slate-600' },
  PARTIAL: { text: 'Sebagian', className: 'bg-amber-100 text-amber-800' },
  RECEIVED: { text: 'Diterima', className: 'bg-emerald-100 text-emerald-800' },
}

// Badge penanda konteks di bawah teks utama sel: jenis job, event, dan agent.
const badge = 'inline-block max-w-full truncate rounded-full px-2 py-0.5 text-xs font-semibold'

const th = 'sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-2 py-2.5 whitespace-nowrap'

// Sel kosong: tanda strip terlihat tetapi dibaca "Kosong" oleh pembaca layar.
const Empty = () => (
  <>
    <span className="text-slate-400" aria-hidden="true">
      —
    </span>
    <span className="sr-only">Kosong</span>
  </>
)

const SORT_COLUMNS: ReadonlyArray<{ key: JobSortKey; text: string }> = [
  { key: 'jobNumber', text: 'No Job' },
  { key: 'stage', text: 'Doc' },
  { key: 'context', text: 'Jenis job' },
  { key: 'agent', text: 'Agent' },
  { key: 'eta', text: 'ETA' },
  { key: 'cipl', text: 'CIPL' },
  { key: 'transportDocument', text: 'B/L · AWB' },
  { key: 'invoice', text: 'Tagihan' },
]

type JobTableProps = {
  jobs: Job[]
  /** Kolom urut aktif; null = urutan bawaan. */
  sort: JobTableSort | null
  onSortChange: (sort: JobTableSort | null) => void
  onGenerate: (job: Job, documentType: BcDocumentKind) => void
}

export function JobTable({ jobs, sort, onSortChange, onGenerate }: JobTableProps) {
  return (
    <div className="card relative max-h-[calc(100dvh-13rem)] min-h-64 overflow-auto">
      <table className="w-full min-w-[980px] table-fixed text-left text-sm">
        <caption className="sr-only">Daftar job. Klik judul kolom untuk mengurutkan.</caption>
        <colgroup>
          <col className="w-[40px]" />
          <col className="w-[148px]" />
          <col className="w-[80px]" />
          <col className="w-[80px]" />
          <col className="min-w-[140px]" />
          <col className="w-[104px]" />
          <col className="w-[88px]" />
          <col className="w-[150px]" />
          <col className="w-[84px]" />
          <col className="w-[44px]" />
        </colgroup>
        <thead className="text-xs font-semibold uppercase tracking-wider text-slate-600">
          <tr>
            <th className={`${th} px-2 text-right`}>No</th>
            {SORT_COLUMNS.map(({ key, text }) => {
              const direction = sort?.key === key ? sort.direction : null
              const Icon =
                direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ArrowUpDown
              return (
                <th
                  key={key}
                  className={th}
                  aria-sort={
                    direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'
                  }
                >
                  <button
                    type="button"
                    onClick={() => onSortChange(nextJobSort(sort, key))}
                    title={`Urutkan berdasarkan ${text}`}
                    className={`inline-flex max-w-full items-center gap-1 uppercase hover:text-slate-900 ${direction ? 'text-slate-900' : ''}`}
                  >
                    <span className="truncate">{text}</span>
                    <Icon
                      size={13}
                      aria-hidden="true"
                      className={direction ? 'shrink-0' : 'shrink-0 opacity-50'}
                    />
                  </button>
                </th>
              )
            })}
            <th className="sticky right-0 top-0 z-20 border-b border-slate-200 bg-slate-50 px-2 py-2">
              <span className="sr-only">Aksi</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job, index) => (
            <JobTableRow key={job.id} job={job} index={index} onGenerate={onGenerate} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function JobTableRow({
  job,
  index,
  onGenerate,
}: Pick<JobTableProps, 'onGenerate'> & {
  job: Job
  index: number
}) {
  const router = useRouter()
  const cipl = deriveCiplStatus(job)
  const agentName = job.party?.kind === 'AGENT' ? job.party.name : null
  const ciplBadge = CIPL_BADGE[cipl.status]
  const eta = jobEta(job)
  const documentType =
    job.transportDocumentType === 'AWB' ? 'AWB' : job.transportDocumentType ? 'B/L' : null

  return (
    <tr
      onClick={(clickEvent) => {
        // Klik pada link, tombol, atau menu aksi punya perilakunya sendiri.
        if (
          (clickEvent.target as HTMLElement).closest(
            'a, button, [role="menu"], [role="presentation"]',
          )
        )
          return
        router.push(`/jobs/${job.id}`)
      }}
      className="group cursor-pointer border-b border-slate-100 bg-white transition-colors last:border-0 hover:bg-slate-50"
    >
      <td className="px-2 py-1.5 text-right align-middle tabular-nums text-slate-500">
        {index + 1}
      </td>
      <td className="px-2 py-1.5 align-middle">
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Link
            href={`/jobs/${job.id}`}
            className="block shrink-0 font-semibold text-slate-900 underline-offset-2 hover:underline"
            aria-label={`Buka job ${jobLabel(job)}`}
          >
            {jobNumberLabel(job)}
          </Link>
        </div>
      </td>
      <td className="px-2 py-1.5 align-middle">
        {job.stage ? (
          <span className={`${badge} bg-slate-100 text-slate-700`}>
            {jobStageLabel(job.internationalJenis, job.stage)}
          </span>
        ) : (
          <Empty />
        )}
      </td>
      <td className="px-2 py-1.5 align-middle">
        <JobContextBadge job={job} />
      </td>
      <td className="px-2 py-1.5 align-middle">
        {agentName ? (
          <p className="truncate text-slate-700" title={agentName}>
            {agentName}
          </p>
        ) : (
          <Empty />
        )}
      </td>
      <td className="px-2 py-1.5 align-middle text-slate-700">
        {eta ? <span className="whitespace-nowrap">{date(eta)}</span> : <Empty />}
      </td>
      <td className="px-2 py-1.5 align-middle">
        {job.sourceJobId ? (
          // Barang job turunan selalu mengikuti job masuknya — status CIPL induk yang berlaku.
          <Empty />
        ) : (
          <span className={`${badge} ${ciplBadge.className}`} title={ciplStatusText(cipl)}>
            {ciplBadge.text}
          </span>
        )}
      </td>
      <td className="px-2 py-1.5 align-middle">
        {job.transportDocumentNumber ? (
          <p className="truncate text-slate-700" title={job.transportDocumentNumber}>
            {job.transportDocumentNumber}
            {documentType ? (
              <span className="ml-1.5 text-xs text-slate-500">{documentType}</span>
            ) : null}
          </p>
        ) : (
          <p className="text-slate-500">Belum ada</p>
        )}
      </td>
      <td className="px-2 py-1.5 align-middle">
        <span className={`${badge} ${INVOICE_BADGE[job.invoice.status]}`}>
          {invoiceStatusLabels[job.invoice.status]}
        </span>
      </td>
      <td className="sticky right-0 bg-white px-1 py-1 text-right align-middle group-hover:bg-slate-50">
        <JobRowMenu job={job} onGenerate={onGenerate} />
      </td>
    </tr>
  )
}

function JobRowMenu({ job, onGenerate }: Pick<JobTableProps, 'onGenerate'> & { job: Job }) {
  const customs = getOperationalDetails(job).customs
  const applicableBc = (Object.keys(customs) as BcDocumentKind[]).filter(
    (key) => customs[key].applicable,
  )
  // Tanpa dokumen BC yang berlaku tidak ada aksi untuk ditampilkan.
  return (
    <ActionMenu
      label={`Menu aksi untuk ${jobLabel(job)}`}
      width={208}
      items={applicableBc.map((key) => ({
        key,
        label: `Unduh ${label(key)}`,
        icon: Download,
        onSelect: () => onGenerate(job, key),
      }))}
    />
  )
}
