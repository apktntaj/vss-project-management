'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Package } from 'lucide-react'

import { containerLabel } from '@/domain/job/manifest'
import { buildManifestView, type ManifestBlockView } from '@/lib/manifest-view'
import { groupJobsByJenis, jobJenisLabel } from '@/lib/job-jenis'
import { JobManifestSheet } from '@/components/job-manifest-sheet'
import type { Job } from '@/lib/data-client'

const numberID = (value: number) =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 }).format(value)

/** No. B/L atau AWB job — identitas kiriman. */
function transportSummary(view: ManifestBlockView): string {
  const document = view.transportDocument
  return document
    ? `${document.type === 'BL' ? 'B/L' : 'AWB'} ${document.number}`
    : 'Dokumen angkut belum diisi'
}

/** Ukuran muatan: daftar kontainer untuk FCL, jumlah paket untuk LCL/tak terdefinisi. */
function loadSummary(view: ManifestBlockView): string {
  const configuration = view.inward?.loadConfiguration
  if (configuration?.kind === 'FCL') return configuration.containers.map(containerLabel).join(' + ')
  return `${view.totals.totalCount} PKG`
}

function chip(extra = '') {
  return `inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${extra}`
}

/**
 * Baris job satu-baris (agent · B/L/AWB · muatan · berat · volume) yang mengembang menjadi grid
 * manifest (JobManifestSection) saat diklik. Level 3–4 pada pohon manifest event.
 */
function JobRowSummary({
  job,
  onOpenJob,
}: {
  job: Job
  onOpenJob: (jobId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const view = buildManifestView(job)

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 border-l-4 border-yellow-400 bg-yellow-100 px-4 py-1.5 text-left text-sm leading-5 hover:bg-yellow-200/70"
      >
        <span className="text-yellow-700">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span
          className="w-[110px] shrink-0 truncate font-bold text-slate-900"
          title={job.jobNumber ? `${job.jobNumber} · ${job.vssNumber}` : job.vssNumber}
        >
          {job.jobNumber ?? job.vssNumber}
        </span>
        <span className="min-w-0 flex-1 truncate font-semibold text-slate-900" title={view.partyName}>
          {view.partyName}
        </span>
        <span className={`${chip('bg-white/70 text-sky-800 ring-yellow-300')} hidden sm:inline-flex`}>
          {transportSummary(view)}
        </span>
        <span className={`${chip('bg-white/70 text-violet-800 ring-yellow-300')} hidden md:inline-flex`}>
          <Package size={12} aria-hidden="true" /> {loadSummary(view)}
        </span>
        <span className="hidden w-[150px] shrink-0 text-right text-xs font-medium leading-5 tabular-nums text-slate-900 lg:block">
          {numberID(view.totals.weightKg)} kg · {numberID(view.totals.volumeCbm)} m³
        </span>
      </button>
      {open && <JobManifestSheet view={view} onOpenJob={() => onOpenJob(job.id)} />}
    </div>
  )
}

/**
 * Pohon manifest satu event: Jenis job (TPPB, Temporary Import, Road Shipment, …) → job satu-baris
 * → grid detail. Dipakai di halaman /jobs setelah baris event diperluas.
 */
export function EventManifestTree({
  jobs,
  onOpenJob,
}: {
  jobs: Job[]
  onOpenJob: (jobId: string) => void
}) {
  const [openJenis, setOpenJenis] = useState<Record<string, boolean>>({})
  const groups = groupJobsByJenis(jobs)

  if (!jobs.length) {
    return <p className="px-5 py-6 text-center text-sm text-slate-500">Belum ada job pada event ini.</p>
  }

  return (
    <div className="divide-y divide-slate-100">
      {groups.map((group) => {
        const isOpen = openJenis[group.key] ?? false
        return (
          <section key={group.key}>
            <button
              type="button"
              onClick={() => setOpenJenis((value) => ({ ...value, [group.key]: !isOpen }))}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-2 border-l-4 border-red-400 bg-red-100 px-4 py-1.5 text-left text-red-950 hover:bg-red-200/70"
            >
              <span className="text-red-500">
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold leading-5 text-red-950">
                {jobJenisLabel(group.key)}
              </span>
              <span className="rounded-full bg-white/80 px-2 py-0 text-[11px] font-semibold leading-5 text-red-700">
                {group.jobs.length} Job
              </span>
            </button>
            {isOpen && (
              <div className="border-t border-slate-100 bg-white">
                {group.jobs.map((job) => (
                  <JobRowSummary key={job.id} job={job} onOpenJob={onOpenJob} />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
