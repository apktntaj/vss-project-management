// Draft form "Buat CIPL": exhibitor → case (koli) → barang di dalam case. Semua isian berupa string
// supaya bisa diketik bebas; modul ini murni (tanpa React/IO) dan menjadi satu-satunya tempat
// konversi draft ⇄ model domain (hasil scan masuk, entri scan domain keluar).

import { nanoid } from 'nanoid'

import { barisBarangSchema, type BarisBarang, type DisposisiBarang } from '@/domain/exhibition/cipl-document'
import { reconcileKoliTotal, type CiplScanEntry } from '@/domain/exhibition/cipl-autofill'
import {
  cbmFromDimension,
  exhibitorLogisticsSchema,
  type ExhibitorLogistics,
  type Koli,
  type OperationalNote,
} from '@/domain/job/manifest'

/** Satu barang di dalam case. `merekModel` dibawa dari scan tetapi tidak diedit di form. */
export type CiplItemDraft = {
  uraian: string
  merekModel: string
  kodeHs: string
  jumlah: string
  satuan: string
  nilaiSatuan: string
  nilaiTotal: string
  /** Remark: dua pilihan di form (disposal / non-disposal) + belum ditetapkan; lihat `disposisiOptions`. */
  disposisi: DisposisiBarang
}

/** Satu case = satu koli beserta barang yang dikemas di dalamnya. */
export type CiplCaseDraft = {
  label: string
  length: string
  width: string
  height: string
  cbm: string
  grossWeight: string
  netWeight: string
  satuanKemasan: string
  items: CiplItemDraft[]
}

export type CiplRowDraft = {
  key: string
  jobNo: string
  name: string
  /** Pass-through dari scan manifest; tidak diedit di form ini. */
  bareCase: string
  hall: string
  booth: string
  /** Catatan operasional hasil scan manifest (Hold until, anomali, dsb.); kosong pada CIPL. */
  notes: OperationalNote[]
  cases: CiplCaseDraft[]
}

export const numberOrNull = (value: string): number | null => {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export const numberText = (value: number | null | undefined): string =>
  value == null ? '' : String(value)

export const round3 = (value: number): number => Math.round(value * 1000) / 1000

export const emptyItem = (): CiplItemDraft => ({
  uraian: '',
  merekModel: '',
  kodeHs: '',
  jumlah: '',
  satuan: '',
  nilaiSatuan: '',
  nilaiTotal: '',
  disposisi: 'RE_EXPORT',
})

export const emptyCase = (): CiplCaseDraft => ({
  label: '',
  length: '',
  width: '',
  height: '',
  cbm: '',
  grossWeight: '',
  netWeight: '',
  satuanKemasan: '',
  items: [emptyItem()],
})

export const emptyRow = (key: string): CiplRowDraft => ({
  key,
  jobNo: '',
  name: '',
  bareCase: '',
  hall: '',
  booth: '',
  notes: [],
  cases: [emptyCase()],
})

function caseFromKoli(koli: Koli): CiplCaseDraft {
  return {
    label: koli.label ?? '',
    length: numberText(koli.dimension?.lengthCm),
    width: numberText(koli.dimension?.widthCm),
    height: numberText(koli.dimension?.heightCm),
    cbm: numberText(koli.volumeCbm),
    grossWeight: numberText(koli.weightKg),
    netWeight: numberText(koli.netWeightKg),
    satuanKemasan: koli.satuanKemasan ?? '',
    items: [],
  }
}

function itemFromBarang(item: BarisBarang): CiplItemDraft {
  return {
    uraian: item.uraian,
    merekModel: item.merekModel ?? '',
    kodeHs: item.kodeHs ?? '',
    jumlah: String(item.jumlah),
    satuan: item.satuan,
    nilaiSatuan: numberText(item.nilaiSatuan),
    nilaiTotal: numberText(item.nilaiTotal),
    // Remark berbentuk toggle dua pilihan dengan bawaan non-disposal; "tidak disebut" dari scan ikut bawaan.
    disposisi: item.disposisi === 'TIDAK_DISEBUT' ? 'RE_EXPORT' : item.disposisi,
  }
}

function rowHeader(
  key: string,
  name: string,
  jobNo: string | null,
  logistics: ExhibitorLogistics,
): Omit<CiplRowDraft, 'cases'> {
  return {
    key,
    jobNo: jobNo ?? '',
    name,
    bareCase: numberText(logistics.koli.bareCaseCount),
    hall: logistics.hall ?? '',
    booth: logistics.booth ?? '',
    notes: logistics.notes,
  }
}

/**
 * CIPL hasil scan: tiap barang masuk ke case yang labelnya sama dengan `refKoli`-nya. Label yang
 * tidak punya koli rinci membentuk case baru (tanpa dimensi); barang tanpa `refKoli` ditampung di
 * satu case tanpa nomor.
 */
export function rowFromScan(
  key: string,
  exhibitor: { name: string; jobNo: string | null; logistics: ExhibitorLogistics; items?: BarisBarang[] },
): CiplRowDraft {
  const cases = exhibitor.logistics.koli.details.map(caseFromKoli)
  const byLabel = new Map<string, CiplCaseDraft>()
  for (const draft of cases) {
    const label = draft.label.trim()
    if (label && !byLabel.has(label)) byLabel.set(label, draft)
  }
  const unnumbered: CiplItemDraft[] = []
  for (const item of exhibitor.items ?? []) {
    const ref = item.refKoli?.trim() || ''
    if (!ref) {
      unnumbered.push(itemFromBarang(item))
      continue
    }
    let target = byLabel.get(ref)
    if (!target) {
      target = { ...emptyCase(), label: ref, items: [] }
      cases.push(target)
      byLabel.set(ref, target)
    }
    target.items.push(itemFromBarang(item))
  }
  if (unnumbered.length) cases.push({ ...emptyCase(), items: unnumbered })
  for (const draft of cases) if (!draft.items.length) draft.items = [emptyItem()]
  return {
    ...rowHeader(key, exhibitor.name, exhibitor.jobNo, exhibitor.logistics),
    cases: cases.length ? cases : [emptyCase()],
  }
}

const itemFilled = (item: CiplItemDraft): boolean =>
  Boolean(
    item.uraian.trim() ||
      item.merekModel.trim() ||
      item.kodeHs.trim() ||
      item.jumlah.trim() ||
      item.satuan.trim() ||
      item.nilaiSatuan.trim() ||
      item.nilaiTotal.trim() ||
      item.disposisi === 'DISPOSED' ||
      item.disposisi === 'GIVE_AWAY',
  )

const caseFilled = (draft: CiplCaseDraft): boolean =>
  Boolean(
    draft.label.trim() ||
      draft.length.trim() ||
      draft.width.trim() ||
      draft.height.trim() ||
      draft.cbm.trim() ||
      draft.grossWeight.trim() ||
      draft.netWeight.trim() ||
      draft.satuanKemasan.trim(),
  ) || draft.items.some(itemFilled)

/** Minimal satu field terisi — gerbang tombol "Tambah exhibitor". */
export function isRowFilled(row: CiplRowDraft): boolean {
  return Boolean(
    row.name.trim() ||
      row.hall.trim() ||
      row.booth.trim(),
  ) || row.cases.some(caseFilled)
}

/** CBM satu case: yang diketik operator, atau hitungan L × W × H bila dikosongkan (null bila tak lengkap). */
export function caseCbm(draft: CiplCaseDraft): number | null {
  return (
    numberOrNull(draft.cbm) ??
    cbmFromDimension(numberOrNull(draft.length), numberOrNull(draft.width), numberOrNull(draft.height))
  )
}

/** Koli dari satu case, atau null bila case hanya wadah barang tanpa data kemasan sama sekali. */
function caseToKoli(draft: CiplCaseDraft): Koli | null {
  const label = draft.label.trim() || null
  const lengthCm = numberOrNull(draft.length)
  const widthCm = numberOrNull(draft.width)
  const heightCm = numberOrNull(draft.height)
  const dimension =
    lengthCm !== null && widthCm !== null && heightCm !== null
      ? { lengthCm, widthCm, heightCm }
      : null
  const volumeCbm = caseCbm(draft)
  const weightKg = numberOrNull(draft.grossWeight)
  const netWeightKg = numberOrNull(draft.netWeight)
  const satuanKemasan = draft.satuanKemasan.trim() || null
  if (
    label === null &&
    dimension === null &&
    volumeCbm === null &&
    weightKg === null &&
    netWeightKg === null &&
    satuanKemasan === null
  ) {
    return null
  }
  return { label, dimension, volumeCbm, weightKg, netWeightKg, satuanKemasan }
}

/**
 * Jumlah turunan dari rincian case untuk exhibitor: paket (aturan label: rentang "7-11" = 5, baris
 * titipan = 0), CBM, gross, dan net (3 desimal). Dipakai sebagai nilai otomatis total exhibitor.
 */
export function rowSums(row: CiplRowDraft): {
  packages: number
  cbm: number
  gross: number
  net: number
} {
  const total = row.cases.reduce(
    (sum, draft) => ({
      cbm: sum.cbm + (caseCbm(draft) ?? 0),
      gross: sum.gross + (numberOrNull(draft.grossWeight) ?? 0),
      net: sum.net + (numberOrNull(draft.netWeight) ?? 0),
    }),
    { cbm: 0, gross: 0, net: 0 },
  )
  const details = row.cases.flatMap((draft) => {
    const koli = caseToKoli(draft)
    return koli ? [koli] : []
  })
  return {
    packages: reconcileKoliTotal(details, null),
    cbm: round3(total.cbm),
    gross: round3(total.gross),
    net: round3(total.net),
  }
}

/** Total harga satu barang hasil Qty × Price (2 desimal); null bila salah satunya kosong. */
export function autoTotalPrice(item: Pick<CiplItemDraft, 'jumlah' | 'nilaiSatuan'>): number | null {
  const qty = numberOrNull(item.jumlah)
  const price = numberOrNull(item.nilaiSatuan)
  return qty === null || price === null ? null : Math.round(qty * price * 100) / 100
}

/**
 * Jumlah turunan level dokumen dari semua baris exhibitor: total amount = jumlah Total price
 * barang (termasuk barang belum terpetakan dari scan), sisanya penjumlahan `rowSums`.
 */
export function documentTotals(
  rows: CiplRowDraft[],
  extraItems: ReadonlyArray<Pick<BarisBarang, 'nilaiTotal'>> = [],
): { amount: number; packages: number; cbm: number; gross: number; net: number } {
  const amount =
    rows.reduce(
      (sum, row) =>
        sum +
        row.cases.reduce(
          (caseSum, draft) =>
            caseSum +
            draft.items.reduce(
              (itemSum, item) => itemSum + (numberOrNull(item.nilaiTotal) ?? autoTotalPrice(item) ?? 0),
              0,
            ),
          0,
        ),
      0,
    ) + extraItems.reduce((sum, item) => sum + (item.nilaiTotal ?? 0), 0)
  const sums = rows.reduce(
    (total, row) => {
      const rowSum = rowSums(row)
      return {
        packages: total.packages + rowSum.packages,
        cbm: total.cbm + rowSum.cbm,
        gross: total.gross + rowSum.gross,
        net: total.net + rowSum.net,
      }
    },
    { packages: 0, cbm: 0, gross: 0, net: 0 },
  )
  return {
    amount: Math.round(amount * 100) / 100,
    packages: sums.packages,
    cbm: round3(sums.cbm),
    gross: round3(sums.gross),
    net: round3(sums.net),
  }
}

function itemToBarang(item: CiplItemDraft, refKoli: string | null): BarisBarang | null {
  const parsed = barisBarangSchema.safeParse({
    uraian: item.uraian.trim(),
    merekModel: item.merekModel.trim() || null,
    kodeHs: item.kodeHs.trim() || null,
    jumlah: numberOrNull(item.jumlah),
    satuan: item.satuan.trim() || 'UNIT',
    nilaiSatuan: numberOrNull(item.nilaiSatuan),
    nilaiTotal: numberOrNull(item.nilaiTotal) ?? autoTotalPrice(item),
    disposisi: item.disposisi,
    refKoli,
  })
  return parsed.success ? parsed.data : null
}

/** Draft → entri scan domain. Barang yang terisi tetapi tidak lolos skema (deskripsi/quantity
 * kosong) tidak disimpan dan dihitung di `invalidItems`. Null bila nama exhibitor kosong atau
 * logistiknya tidak valid. */
export function rowToScanEntry(row: CiplRowDraft): { entry: CiplScanEntry; invalidItems: number } | null {
  const name = row.name.trim()
  if (!name) return null
  const details: Koli[] = []
  const items: BarisBarang[] = []
  let invalidItems = 0
  for (const draft of row.cases) {
    const label = draft.label.trim() || null
    const koli = caseToKoli(draft)
    let koliId: string | null = null
    if (koli) {
      koliId = nanoid()
      details.push({ ...koli, id: koliId })
    }
    for (const item of draft.items) {
      if (!itemFilled(item)) continue
      const barang = itemToBarang(item, label)
      if (barang) items.push({ ...barang, refKoliIds: koliId ? [koliId] : [] })
      else invalidItems += 1
    }
  }
  const bareCase = numberOrNull(row.bareCase)
  const parsed = exhibitorLogisticsSchema.safeParse({
    hall: row.hall.trim() || null,
    booth: row.booth.trim() || null,
    koli: {
      totalCount: reconcileKoliTotal(details, null),
      bareCaseCount: bareCase === null ? null : Math.round(bareCase),
      details,
    },
    notes: row.notes,
  })
  if (!parsed.success) return null
  return { entry: { name, statedTotalCount: null, logistics: parsed.data, items }, invalidItems }
}
