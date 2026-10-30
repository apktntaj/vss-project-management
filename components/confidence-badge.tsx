'use client'

import type { ConfidenceBand } from '@/domain/exhibition/source-documents'

const bandLabel: Record<ConfidenceBand, string> = {
  LOW_CONFIDENCE: 'Keyakinan rendah',
  MEDIUM_CONFIDENCE: 'Keyakinan sedang',
  HIGH_CONFIDENCE: 'Keyakinan tinggi',
}

const bandTone: Record<ConfidenceBand, string> = {
  LOW_CONFIDENCE: 'bg-rose-100 text-rose-700',
  MEDIUM_CONFIDENCE: 'bg-amber-100 text-amber-700',
  HIGH_CONFIDENCE: 'bg-emerald-100 text-emerald-700',
}

export function ConfidenceBadge({ band, score }: { band: ConfidenceBand; score?: number }) {
  const label = `${bandLabel[band]}${typeof score === 'number' ? ` ${Math.round(score * 100)}%` : ''}`
  return (
    <span
      aria-label={label}
      role="status"
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${bandTone[band]}`}
    >
      {label}
    </span>
  )
}

/** Penanda field perlu ditinjau; tempelkan id ke aria-describedby input terkait (R6.3). */
export function ReviewNotice({ id }: { id: string }) {
  return (
    <p id={id} className="mt-1 text-xs text-rose-600" aria-live="polite">
      Perlu ditinjau — periksa kembali nilai ini.
    </p>
  )
}
