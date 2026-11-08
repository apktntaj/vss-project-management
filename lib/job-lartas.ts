// Derivasi murni HS code dari aggregate Job untuk cek LARTAS (tanpa I/O, gaya `lib/job-readiness.ts`).
// Impor hanya dari domain — jangan dari `@/lib/data-client` (modul itu `'use client'`).

import type { JobInvoiceItem } from '@/domain/exhibition/source-documents'
import type { JobCiplLine } from '@/domain/job/types'
import { LARTAS_MAX_CODES_PER_REQUEST } from '@/domain/lartas/types'

export type JobHsUsage = { description: string; source: 'CIPL' | 'INVOICE' }

export type JobHsCode = {
  /** 8 digit tanpa pemisah. */
  hsCode: string
  formatted: string
  usages: JobHsUsage[]
}

export type JobHsCodeCollection = {
  /** HS 8 digit unik, siap dicek. */
  valid: JobHsCode[]
  /** Nilai HS yang terisi tetapi bukan 8/10 digit (apa adanya, unik). */
  invalid: string[]
  /** Nilai 10 digit (pos tarif nasional) yang dipakai 8 digit pertamanya (apa adanya, unik). */
  truncated: string[]
  /** Jumlah baris barang tanpa HS code. */
  missingCount: number
}

export function formatHsCode(hsCode: string): string {
  return /^\d{8}$/.test(hsCode) ? hsCode.replace(/(\d{4})(\d{2})(\d{2})/, '$1.$2.$3') : hsCode
}

export type NormalizedHsCode = {
  /** 8 digit siap dikirim ke INSW. */
  digits: string
  /** Nilai asli bila kode 10 digit dipotong; null bila memang sudah 8 digit. */
  truncatedFrom: string | null
}

/**
 * Kunci pencarian INSW adalah HS Indonesia 8 digit. Dokumen sering menulis pos tarif 10 digit
 * (8 digit BTKI + 2 digit fasilitas/statistik), jadi 8 digit pertamanya yang dipakai. Kode lain
 * (mis. 6 digit) tidak bisa ditebak dan dikembalikan null.
 */
export function normalizeHsCode(raw: string | null | undefined): NormalizedHsCode | null {
  const trimmed = raw?.trim() ?? ''
  if (!trimmed) return null
  const digits = trimmed.replace(/\D/g, '')
  if (/^\d{8}$/.test(digits)) return { digits, truncatedFrom: null }
  if (/^\d{10}$/.test(digits)) return { digits: digits.slice(0, 8), truncatedFrom: trimmed }
  return null
}

type HsInput = { raw: string | null | undefined; usage: JobHsUsage }

/** Kumpulkan HS code unik dari baris CIPL, dan dari item invoice yang belum tercakup CIPL. */
export function collectJobHsCodes(
  ciplLines: readonly Pick<JobCiplLine, 'items'>[],
  invoiceItems: readonly Pick<JobInvoiceItem, 'description' | 'hsCode'>[] = [],
): JobHsCodeCollection {
  const inputs: HsInput[] = []
  for (const line of ciplLines) {
    for (const item of line.items) {
      inputs.push({ raw: item.kodeHs, usage: { description: item.uraian, source: 'CIPL' } })
    }
  }
  // Invoice hanya dipakai bila CIPL belum ada, supaya barang yang sama tidak dihitung dua kali.
  if (inputs.length === 0) {
    for (const item of invoiceItems) {
      inputs.push({ raw: item.hsCode, usage: { description: item.description, source: 'INVOICE' } })
    }
  }

  const valid = new Map<string, JobHsCode>()
  const invalid = new Set<string>()
  const truncated = new Set<string>()
  let missingCount = 0
  for (const { raw, usage } of inputs) {
    const trimmed = raw?.trim() ?? ''
    if (!trimmed) {
      missingCount += 1
      continue
    }
    const normalized = normalizeHsCode(trimmed)
    if (!normalized) {
      invalid.add(trimmed)
      continue
    }
    if (normalized.truncatedFrom) truncated.add(normalized.truncatedFrom)
    const existing = valid.get(normalized.digits)
    if (existing) existing.usages.push(usage)
    else
      valid.set(normalized.digits, {
        hsCode: normalized.digits,
        formatted: formatHsCode(normalized.digits),
        usages: [usage],
      })
  }
  return { valid: [...valid.values()], invalid: [...invalid], truncated: [...truncated], missingCount }
}

export function chunkHsCodes(codes: readonly string[], size = LARTAS_MAX_CODES_PER_REQUEST): string[][] {
  const chunks: string[][] = []
  for (let start = 0; start < codes.length; start += size) chunks.push(codes.slice(start, start + size))
  return chunks
}
