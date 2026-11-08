'use client'

// Tabel daftar job sederhana untuk /jobs, mengikuti gaya tabel di halaman events: satu baris teks
// per job, tautan ke detail, dan aksi unduh BC di menu titik tiga.

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Download, MoreVertical } from 'lucide-react'

import { type Job, getOperationalDetails } from '@/lib/data-client'
import {
  invoiceStatusLabels,
  transportModeLabels,
  type BcDocumentKind,
} from '@/domain/job/types'
import { ciplStatusText, deriveCiplStatus, type CiplStatus } from '@/domain/job/cipl-status'
import { JobContextBadge } from '@/components/job-context-badge'
import { StatusBadge } from '@/components/status-badge'
import { label } from '@/components/job-row'
import { jobLabel } from '@/domain/job/numbering'

const INVOICE_BADGE: Record<Job['invoice']['status'], string> = {
  NOT_READY: 'bg-slate-100 text-slate-500',
  READY: 'bg-blue-100 text-blue-800',
  SENT: 'bg-amber-100 text-amber-800',
  PAID: 'bg-emerald-100 text-emerald-800',
}

const CIPL_BADGE: Record<CiplStatus, { text: string; className: string }> = {
  MISSING: { text: 'Menunggu', className: 'bg-slate-100 text-slate-500' },
  PARTIAL: { text: 'Sebagian', className: 'bg-amber-100 text-amber-800' },
  RECEIVED: { text: 'Diterima', className: 'bg-emerald-100 text-emerald-800' },
}

// Badge penanda konteks di bawah teks utama sel: jenis job, event, dan agent.
const badge = 'inline-block max-w-full truncate rounded-full px-2 py-0.5 text-xs font-semibold'

const th = 'sticky top-0 z-10 border-b border-slate-200 bg-white px-2 py-2 whitespace-nowrap'

type JobTableProps = {
  jobs: Job[]
  onGenerate: (job: Job, documentType: BcDocumentKind) => void
}

export function JobTable({ jobs, ...handlers }: JobTableProps) {
  return (
    <div className="card max-h-[65vh] overflow-auto">
      <table className="w-full min-w-[900px] table-fixed text-left text-sm">
        <colgroup>
          <col className="w-[40px]" />
          <col className="w-[120px]" />
          <col className="w-[96px]" />
          <col />
          <col className="w-[70px]" />
          <col className="w-[100px]" />
          <col className="w-[140px]" />
          <col className="w-[100px]" />
          <col className="w-[120px]" />
          <col className="w-[44px]" />
        </colgroup>
        <thead className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          <tr>
            <th className={`${th} px-2 text-right`}>No</th>
            <th className={th}>No Job</th>
            <th className={th}>Jenis job</th>
            <th className={th}>Agent</th>
            <th className={th}>Moda</th>
            <th className={th}>CIPL</th>
            <th className={th}>B/L · AWB</th>
            <th className={th}>Tagihan</th>
            <th className={th}>Status</th>
            <th className="sticky right-0 top-0 z-20 border-b border-slate-200 bg-white px-2 py-2">
              <span className="sr-only">Aksi</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job, index) => (
            <JobTableRow key={job.id} job={job} index={index} {...handlers} />
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
}: Omit<JobTableProps, 'jobs'> & {
  job: Job
  index: number
}) {
  const router = useRouter()
  const cipl = deriveCiplStatus(job)
  const agentName = job.party?.kind === 'AGENT' ? job.party.name : null
  const ciplBadge = CIPL_BADGE[cipl.status]
  const documentType =
    job.transportDocumentType === 'AWB' ? 'AWB' : job.transportDocumentType ? 'B/L' : null

  return (
    <tr
      onClick={(clickEvent) => {
        // Klik pada link, tombol, atau menu aksi punya perilakunya sendiri.
        if ((clickEvent.target as HTMLElement).closest('a, button, [role="menu"], [role="presentation"]')) return
        router.push(`/jobs/${job.id}`)
      }}
      className="group cursor-pointer border-b border-slate-100 odd:bg-slate-50/70 last:border-0 hover:bg-orange-50/40"
    >
      <td className="px-2 py-1.5 text-right align-middle tabular-nums text-slate-400">{index + 1}</td>
      <td className="px-2 py-1.5 align-middle">
        <Link
          href={`/jobs/${job.id}`}
          className="block truncate font-semibold text-slate-600 hover:text-orange-700"
          aria-label={`Buka job ${jobLabel(job)}`}
        >
          {jobLabel(job)}
        </Link>
      </td>
      <td className="px-2 py-1.5 align-middle">
        <JobContextBadge job={job} />
      </td>
      <td className="px-2 py-1.5 align-middle">
        {agentName ? (
          <p className="truncate text-slate-500" title={agentName}>
            {agentName}
          </p>
        ) : (
          <p className="text-slate-300">—</p>
        )}
      </td>
      <td className="px-2 py-1.5 align-middle text-slate-500">
        {job.transportMode ? (
          transportModeLabels[job.transportMode]
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="px-2 py-1.5 align-middle">
        <span className={`${badge} ${ciplBadge.className}`} title={ciplStatusText(cipl)}>
          {ciplBadge.text}
        </span>
      </td>
      <td className="px-2 py-1.5 align-middle">
        {job.transportDocumentNumber ? (
          <p className="truncate text-slate-500" title={job.transportDocumentNumber}>
            {job.transportDocumentNumber}
            {documentType ? <span className="ml-1.5 text-xs text-slate-400">{documentType}</span> : null}
          </p>
        ) : (
          <p className="text-slate-300">Belum ada</p>
        )}
      </td>
      <td className="px-2 py-1.5 align-middle">
        <span className={`${badge} ${INVOICE_BADGE[job.invoice.status]}`}>
          {invoiceStatusLabels[job.invoice.status]}
        </span>
      </td>
      <td className="px-2 py-1.5 align-middle">
        <StatusBadge status={job.status} />
      </td>
      <td className="sticky right-0 bg-white px-2 py-1.5 text-right align-middle group-odd:bg-slate-50 group-hover:bg-orange-50">
        <JobRowMenu job={job} onGenerate={onGenerate} />
      </td>
    </tr>
  )
}

function JobRowMenu({
  job,
  onGenerate,
}: Omit<JobTableProps, 'jobs'> & { job: Job }) {
  // Menu di-anchor fixed dari getBoundingClientRect agar tidak terpotong wadah tabel yang overflow.
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number } | null>(null)
  const customs = getOperationalDetails(job).customs
  const applicableBc = (Object.keys(customs) as BcDocumentKind[]).filter(
    (key) => customs[key].applicable,
  )
  const name = jobLabel(job)
  // Tanpa dokumen BC yang berlaku tidak ada aksi untuk ditampilkan.
  if (!applicableBc.length) return null

  const item =
    'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50'
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
          setMenuAnchor((current) =>
            current ? null : { top: rect.bottom + 4, left: rect.right - 208 },
          )
        }}
        aria-label={`Menu aksi untuk ${name}`}
        aria-expanded={menuAnchor !== null}
        aria-haspopup="menu"
        className="rounded-lg p-1 text-slate-500 hover:bg-orange-50 hover:text-orange-700"
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
            aria-label={`Aksi untuk ${name}`}
            className="fixed z-50 w-52 overflow-hidden rounded-xl border border-black/10 bg-white py-1 shadow-lg"
            style={{ top: menuAnchor.top, left: menuAnchor.left }}
          >
            {applicableBc.map((key) => (
              <button
                key={key}
                role="menuitem"
                type="button"
                className={item}
                onClick={run(() => onGenerate(job, key))}
              >
                <Download size={15} /> Unduh {label(key)}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
