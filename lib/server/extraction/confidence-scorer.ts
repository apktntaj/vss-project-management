import 'server-only'

import { CONFIDENCE_BANDS } from './config'
import type { ConfidenceBand, ConfidenceMap } from '@/domain/exhibition/source-documents'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const clamp = (value: number) => Math.max(0, Math.min(1, value))

function fieldConfidence(value: unknown): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? 0.9 : 0
  if (typeof value === 'boolean') return 0.9
  if (Array.isArray(value)) return value.length ? 0.8 : 0
  if (typeof value === 'object') return 0.8
  const text = String(value).trim()
  if (!text) return 0
  if (ISO_DATE.test(text)) return 0.95
  return clamp(0.5 + (text.length / 50) * 0.4)
}

export function scoreFields(fields: Record<string, unknown>): ConfidenceMap {
  return Object.fromEntries(
    Object.entries(fields).map(([path, value]) => [path, fieldConfidence(value)]),
  )
}

export function aggregateConfidence(map: ConfidenceMap): number {
  const scores = Object.values(map).filter((score) => Number.isFinite(score))
  if (!scores.length) return 0
  return clamp(scores.reduce((sum, score) => sum + score, 0) / scores.length)
}

export function bandForScore(aggregate: number): ConfidenceBand {
  const score = clamp(aggregate)
  if (score < CONFIDENCE_BANDS.LOW) return 'LOW_CONFIDENCE'
  if (score < CONFIDENCE_BANDS.MEDIUM) return 'MEDIUM_CONFIDENCE'
  return 'HIGH_CONFIDENCE'
}
