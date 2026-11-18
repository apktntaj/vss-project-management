'use client'

// Banner tenggat pabean di header detail job: tenggat re-ekspor jaminan (Temporary Import) dan masa
// berlaku carnet (ATA) dengan hitung mundur dan tingkat peringatan (`lib/job-deadlines`). Tingkat
// diwakili warna DAN teks/ikon (tidak mengandalkan warna saja). Job re-ekspor membaca dari job masuk.

import Link from 'next/link'
import { CalendarClock, TriangleAlert } from 'lucide-react'

import {
  deadlineCountdown,
  jobDeadlines,
  type DeadlineLevel,
  type JobDeadline,
} from '@/lib/job-deadlines'
import type { Job } from '@/lib/data-client'

const levelStyles: Record<DeadlineLevel, { box: string; label: string }> = {
  ok: { box: 'border-slate-200 bg-white text-slate-800', label: 'Terjadwal' },
  warning: { box: 'border-amber-300 bg-amber-50 text-amber-900', label: 'Mendekati tenggat' },
  critical: { box: 'border-rose-300 bg-rose-50 text-rose-900', label: 'Mendesak' },
  expired: { box: 'border-rose-400 bg-rose-100 text-rose-950', label: 'Lewat tenggat' },
}

const formatDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return value
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  )
}

function DeadlineItem({
  deadline,
  source,
  onOpenPabean,
}: {
  deadline: JobDeadline
  source: Job | null
  onOpenPabean: () => void
}) {
  const style = levelStyles[deadline.level]
  const Icon = deadline.level === 'ok' ? CalendarClock : TriangleAlert
  return (
    <div
      role="status"
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-2.5 text-sm ${style.box}`}
    >
      <Icon size={18} className="shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        <span className="font-semibold">{deadline.label}</span>{' '}
        {formatDate(deadline.date)}
        {' · '}
        <span className="font-semibold">{deadlineCountdown(deadline.daysLeft)}</span>
        <span className="ml-2 text-xs font-medium">({style.label})</span>
        {deadline.fromSource && <span className="ml-2 text-xs">dari job masuk</span>}
      </p>
      {deadline.fromSource ? (
        source ? (
          <Link
            href={`/jobs/${source.id}?tab=pabean`}
            className="rounded text-xs font-semibold underline underline-offset-2"
          >
            Buka job masuk
          </Link>
        ) : null
      ) : (
        <button
          type="button"
          onClick={onOpenPabean}
          className="min-h-8 rounded px-1 text-xs font-semibold underline underline-offset-2"
        >
          Lihat di tab Pabean
        </button>
      )}
    </div>
  )
}

export function JobDeadlineBanner({
  job,
  source,
  onOpenPabean,
}: {
  job: Job
  /** Job masuk rangkaian ini (sumber tenggat bagi job re-ekspor); null bila belum/ gagal dimuat. */
  source: Job | null
  onOpenPabean: () => void
}) {
  const deadlines = jobDeadlines(job, source)
  if (deadlines.length === 0) return null
  return (
    <div className="space-y-2">
      {deadlines.map((deadline) => (
        <DeadlineItem
          key={deadline.kind}
          deadline={deadline}
          source={source}
          onOpenPabean={onOpenPabean}
        />
      ))}
    </div>
  )
}
