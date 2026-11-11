// Model form rincian barang pameran (lampiran surat Kanwil): satu baris per barang CIPL job.
// Murni (tanpa I/O); renderer Excel hanya menggambar model ini.

import type { VenueTppbProfile } from '@/domain/event/types'
import type { Exhibitor } from '@/domain/exhibitor/types'
import type { Job } from '@/domain/job/types'
import { formatIdDateRange, type KanwilEventInfo } from './kanwil-letter'

export type TppbTaxStatus = 'SPDN' | 'SPLN' | '-'

export type TppbGoodsFormRow = {
  no: number
  description: string
  quantity: number
  unit: string
  unitValue: number | null
  owner: string
  npwp: string
  taxStatus: TppbTaxStatus
}

export type TppbGoodsFormModel = {
  operatorName: string
  operatorNpwp: string
  operatorAddress: string
  exhibitionTitle: string
  period: string
  currency: string | null
  rows: TppbGoodsFormRow[]
}

const blank = (value: string | null | undefined) => !value || value.trim() === ''

export function missingTppbGoodsFormFields(event: KanwilEventInfo, venue: VenueTppbProfile): string[] {
  const missing: string[] = []
  if (blank(venue.operatorName)) missing.push('nama pengusaha TPPB (Settings → Venue)')
  if (blank(venue.operatorNpwp)) missing.push('NPWP pengusaha TPPB (Settings → Venue)')
  if (blank(venue.operatorAddress)) missing.push('alamat pengusaha TPPB (Settings → Venue)')
  if (!event.startsOn || !event.endsOn) missing.push('tanggal mulai & selesai event')
  return missing
}

/** Mengasumsikan `missingTppbGoodsFormFields` kosong; field null dipakai sebagai string kosong. */
export function buildTppbGoodsForm(
  event: KanwilEventInfo,
  venue: VenueTppbProfile,
  job: Job,
  exhibitors: ReadonlyMap<string, Exhibitor>,
): TppbGoodsFormModel {
  const rows: TppbGoodsFormRow[] = []
  for (const line of job.ciplLines) {
    const exhibitor = line.exhibitorId ? exhibitors.get(line.exhibitorId) : undefined
    const owner = exhibitor?.name ?? line.exhibitor?.name ?? line.nameOnDocument
    const taxStatus: TppbTaxStatus = !exhibitor ? '-' : exhibitor.kind === 'LOCAL' ? 'SPDN' : 'SPLN'
    for (const item of line.items) {
      rows.push({
        no: rows.length + 1,
        description: item.merekModel ? `${item.uraian} - ${item.merekModel}` : item.uraian,
        quantity: item.jumlah,
        unit: item.satuan,
        unitValue: item.nilaiSatuan,
        owner,
        npwp: exhibitor?.npwp ?? '-',
        taxStatus,
      })
    }
  }

  return {
    operatorName: venue.operatorName?.trim() ?? '',
    operatorNpwp: venue.operatorNpwp?.trim() ?? '',
    operatorAddress: venue.operatorAddress?.trim() ?? '',
    exhibitionTitle: event.alias ? `${event.alias} (${event.name})` : event.name,
    period: formatIdDateRange(event.startsOn ?? '', event.endsOn ?? '', { separator: ' - ', padDay: true }),
    currency: job.ciplDocument?.mataUang ?? null,
    rows,
  }
}
