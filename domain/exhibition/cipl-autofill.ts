/**
 * Mengapa: sebuah CIPL konsolidasi adalah SATU dokumen untuk BANYAK exhibitor — pada CIPL
 * S.12/ALP-VPN/2026 ada enam exhibitor, masing-masing memegang rentang nomor paketnya sendiri.
 * Exhibitor sendiri adalah entitas milik domain event (satu exhibitor ikut satu event, punya
 * hall/booth dan dibawa oleh agent), sedangkan CIPL datang bersama job. Modul ini adalah
 * jembatan di antaranya: ia memutuskan entri CIPL mana menunjuk exhibitor event yang SUDAH ada
 * dan mana yang belum pernah terdaftar, sehingga job menyimpan `exhibitorId` — bukan string
 * nama — dan laporan inward manifest per event dapat dirakit dari satu sumber.
 *
 * Fungsi murni, tanpa I/O: keputusan penautan dapat diuji tanpa database maupun LLM. Penulisan
 * (membuat exhibitor baru, menyimpan logistik) dilakukan pemanggil di lapisan data.
 */

import { matchExhibitorByName, normalizeExhibitorName } from '@/domain/event/exhibitor-matching'
import {
  countKoliFromLabels,
  koliTersendiri,
  type ExhibitorLogistics,
  type Koli,
} from '@/domain/job/manifest'
import type { BarisBarang } from './cipl-document'

/** Satu entri hasil partisi CIPL: nama seperti tertera, koli, dan baris barangnya. */
export type CiplScanEntry = {
  name: string
  logistics: ExhibitorLogistics
  /**
   * Total paket yang DISEBUT dokumen untuk exhibitor ini — kolom "Total Package" pada inward
   * manifest. `null` bila dokumen tidak menyebutnya: sebuah CIPL konsolidasi hanya punya total
   * footer per dokumen ("TTL: 40 PACKAGES"), yang milik seluruh kontainer, bukan satu exhibitor.
   *
   * Pembedaan ini menentukan hasil: bila dokumen menyebut total, total itu menang (manifest S.08
   * menyebut 17 PKG padahal hanya tujuh koli dirinci). Bila tidak, label barislah yang berwenang
   * (CIPL S.12: rentang "7-11" membuktikan 21 paket, dan baris titipan tidak dihitung).
   */
  statedTotalCount?: number | null
  items: BarisBarang[]
}

/** Exhibitor event yang sudah terdaftar — hanya yang dibutuhkan untuk pencocokan. */
export type EventExhibitorRef = { id: string; name: string }

export const autofillResolutions = ['TERTAUT', 'BARU', 'AMBIGU'] as const
export type AutofillResolution = (typeof autofillResolutions)[number]

export const autofillResolutionLabels: Record<AutofillResolution, string> = {
  TERTAUT: 'Tertaut',
  BARU: 'Baru',
  AMBIGU: 'Perlu dipilih',
}

export type CiplAutofillRow = {
  /** Nama yang dipakai di UI: nama master bila tertaut, nama CIPL bila belum terdaftar. */
  name: string
  /** Nama persis seperti tertulis di CIPL — bukti mentah, tidak pernah ditimpa. */
  namaTertera: string
  exhibitorId: string | null
  resolution: AutofillResolution
  /** Terisi hanya saat AMBIGU: dua exhibitor event bernama sama setelah normalisasi. */
  candidates: EventExhibitorRef[]
  logistics: ExhibitorLogistics
  items: BarisBarang[]
}

export type CiplAutofillPlan = {
  rows: CiplAutofillRow[]
  warnings: string[]
}

/**
 * Total koli sebuah entri: label baris berwenang (rentang "7-11" lima paket, baris titipan nol),
 * kecuali dokumen menyebut total per exhibitor sendiri — maka yang lebih besar menang, karena
 * rincian koli pada manifest sering hanya sebagian.
 */
export function reconcileKoliTotal(
  details: ReadonlyArray<Koli>,
  statedTotal: number | null | undefined,
): number {
  // Lantai: tiap baris yang bukan titipan adalah satu koli nyata. Tanpa ini, dokumen yang
  // mengulang nomor paket (mis. dua baris "24") menghasilkan total di bawah jumlah rinciannya
  // dan melanggar invariant koliCollectionSchema.
  const floor = koliTersendiri(details).length
  const fromLabels = Math.max(countKoliFromLabels(details), floor)
  return typeof statedTotal === 'number' ? Math.max(statedTotal, fromLabels) : fromLabels
}

function sumStated(
  left: number | null | undefined,
  right: number | null | undefined,
): number | null {
  if (typeof left !== 'number' && typeof right !== 'number') return null
  return (left ?? 0) + (right ?? 0)
}

function mergeEntries(left: CiplScanEntry, right: CiplScanEntry): CiplScanEntry {
  const details: Koli[] = [...left.logistics.koli.details, ...right.logistics.koli.details]
  const statedTotalCount = sumStated(left.statedTotalCount, right.statedTotalCount)
  return {
    name: left.name,
    statedTotalCount,
    logistics: {
      // Hall/booth pertama yang terbaca menang; entri lanjutan di halaman berikutnya sering kosong.
      hall: left.logistics.hall ?? right.logistics.hall,
      booth: left.logistics.booth ?? right.logistics.booth,
      koli: {
        details,
        bareCaseCount:
          left.logistics.koli.bareCaseCount === null && right.logistics.koli.bareCaseCount === null
            ? null
            : (left.logistics.koli.bareCaseCount ?? 0) + (right.logistics.koli.bareCaseCount ?? 0),
        totalCount: reconcileKoliTotal(details, statedTotalCount),
      },
      notes: [...left.logistics.notes, ...right.logistics.notes],
    },
    items: [...left.items, ...right.items],
  }
}

/**
 * Satukan entri CIPL yang menunjuk perusahaan yang sama (nama terulang di halaman lanjutan),
 * lalu tautkan tiap entri ke exhibitor event bila namanya cocok setelah normalisasi.
 *
 * Entri tanpa pasangan dikembalikan sebagai BARU — pemanggil yang membuat exhibitor event-nya,
 * supaya keputusan "tulis ke master data" tetap satu tempat dan dapat dibatalkan operator.
 */
export function resolveCiplAutofill(
  entries: ReadonlyArray<CiplScanEntry>,
  pool: ReadonlyArray<EventExhibitorRef>,
): CiplAutofillPlan {
  const warnings: string[] = []
  const merged = new Map<string, CiplScanEntry>()
  const order: string[] = []

  for (const entry of entries) {
    const name = entry.name.trim()
    if (!name) {
      warnings.push('Satu entri CIPL dilewati karena tidak punya nama exhibitor.')
      continue
    }
    const key = normalizeExhibitorName(name) || name.toUpperCase()
    const normalized: CiplScanEntry = {
      name,
      statedTotalCount: entry.statedTotalCount ?? null,
      logistics: {
        ...entry.logistics,
        koli: {
          ...entry.logistics.koli,
          totalCount: reconcileKoliTotal(entry.logistics.koli.details, entry.statedTotalCount),
        },
      },
      items: [...entry.items],
    }
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, normalized)
      order.push(key)
      continue
    }
    merged.set(key, mergeEntries(existing, normalized))
    warnings.push(
      `Entri "${name}" muncul lebih dari sekali di dokumen dan digabung menjadi satu peserta.`,
    )
  }

  const rows = order.map((key): CiplAutofillRow => {
    const entry = merged.get(key)!
    const match = matchExhibitorByName(entry.name, pool)
    if (match.kind === 'MATCHED') {
      return {
        name: match.exhibitor.name,
        namaTertera: entry.name,
        exhibitorId: match.exhibitor.id,
        resolution: 'TERTAUT',
        candidates: [],
        logistics: entry.logistics,
        items: entry.items,
      }
    }
    if (match.kind === 'AMBIGUOUS') {
      warnings.push(
        `"${entry.name}" cocok dengan ${match.candidates.length} exhibitor event — pilih yang benar sebelum menyimpan.`,
      )
      return {
        name: entry.name,
        namaTertera: entry.name,
        exhibitorId: null,
        resolution: 'AMBIGU',
        candidates: [...match.candidates],
        logistics: entry.logistics,
        items: entry.items,
      }
    }
    return {
      name: entry.name,
      namaTertera: entry.name,
      exhibitorId: null,
      resolution: 'BARU',
      candidates: [],
      logistics: entry.logistics,
      items: entry.items,
    }
  })

  return { rows, warnings }
}

/** Ringkasan untuk pesan toast/badge: berapa tertaut, berapa akan dibuat, berapa perlu dipilih. */
export function summarizeAutofill(rows: ReadonlyArray<CiplAutofillRow>) {
  return {
    total: rows.length,
    tertaut: rows.filter((row) => row.resolution === 'TERTAUT').length,
    baru: rows.filter((row) => row.resolution === 'BARU').length,
    ambigu: rows.filter((row) => row.resolution === 'AMBIGU').length,
  }
}
