// Model surat permohonan fasilitas pabean ke Kanwil DJBC. Murni (tanpa I/O): route handler
// memuat data, modul ini menyusun teks, renderer PDF hanya menggambar. Pemohon = pengusaha TPPB
// (pengelola venue), karena pabean hanya mengenal pengusaha TPPB sebagai pemohon.

import { z } from 'zod'

import type { VenueSignatory, VenueTppbProfile } from '@/domain/event/types'

export type KanwilEventInfo = {
  name: string
  alias: string | null
  organizerName: string
  startsOn: string | null
  endsOn: string | null
}

export const kanwilLetterInputSchema = z
  .object({
    letterNumber: z.string().trim().min(1, 'Nomor surat wajib diisi.').max(100, 'Nomor surat maksimal 100 karakter.'),
    letterDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal surat tidak valid.'),
    greeting: z
      .string()
      .trim()
      .max(1000, 'Salam pembuka maksimal 1000 karakter.')
      .nullish()
      .transform((value) => value || null),
  })
  .strict()
export type KanwilLetterInput = z.infer<typeof kanwilLetterInputSchema>

export type KanwilLetterModel = {
  /** Metadata PDF. */
  title: string
  letterNumber: string
  /** "Tangerang, 17 April 2024"; tanpa kota hanya tanggal. */
  placeDate: string
  subject: string
  recipient: string[]
  paragraphs: string[]
  attachmentsIntro: string
  attachments: string[]
  closing: string
  companyName: string
  signatories: VenueSignatory[]
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

// Diurai dari string `YYYY-MM-DD` (bukan `new Date`) supaya tidak bergeser oleh zona waktu.
function parseIsoDate(isoDate: string): { year: string; month: number; day: number } {
  const [year, month, day] = isoDate.split('-')
  return { year, month: Number(month), day: Number(day) }
}

function formatDay(day: number, padDay: boolean): string {
  return padDay ? String(day).padStart(2, '0') : String(day)
}

export function formatIdDate(isoDate: string, padDay = false): string {
  const { year, month, day } = parseIsoDate(isoDate)
  return `${formatDay(day, padDay)} ${MONTHS[month - 1]} ${year}`
}

export function formatIdDateRange(
  start: string,
  end: string,
  options: { separator?: string; padDay?: boolean } = {},
): string {
  const { separator = ' sampai dengan ', padDay = false } = options
  if (start === end) return formatIdDate(start, padDay)
  const from = parseIsoDate(start)
  const to = parseIsoDate(end)
  const toText = formatIdDate(end, padDay)
  if (from.year !== to.year) return `${formatIdDate(start, padDay)}${separator}${toText}`
  if (from.month !== to.month) return `${formatDay(from.day, padDay)} ${MONTHS[from.month - 1]}${separator}${toText}`
  return `${formatDay(from.day, padDay)}${separator}${toText}`
}

const blank = (value: string | null | undefined) => !value || value.trim() === ''

export function missingKanwilLetterFields(event: KanwilEventInfo, venue: VenueTppbProfile): string[] {
  const missing: string[] = []
  if (blank(venue.operatorName)) missing.push('nama pengusaha TPPB (Settings → Venue)')
  if (blank(venue.customsRegionalOffice)) missing.push('Kanwil DJBC tujuan (Settings → Venue)')
  if (venue.signatories.length === 0) missing.push('penandatangan (Settings → Venue)')
  if (!event.startsOn || !event.endsOn) missing.push('tanggal mulai & selesai event')
  return missing
}

/** Mengasumsikan `missingKanwilLetterFields` kosong; field null dipakai sebagai string kosong. */
export function buildKanwilLetter(
  event: KanwilEventInfo,
  venue: VenueTppbProfile,
  input: KanwilLetterInput,
): KanwilLetterModel {
  const organizer = event.organizerName.trim()
  const city = venue.city?.trim()
  const letterDate = formatIdDate(input.letterDate)
  const period = formatIdDateRange(event.startsOn ?? '', event.endsOn ?? '')
  const body =
    `Dalam rangka penyelenggaraan pameran khusus yang bersifat internasional, dengan ini kami mengajukan ` +
    `permohonan untuk diberikan fasilitas pabean, cukai dan perpajakan atas barang pameran yang didatangkan ` +
    `untuk kegiatan ${event.name}${organizer ? ` yang diselenggarakan oleh ${organizer}` : ''} pada tanggal ${period}.`

  return {
    title: `Surat Permohonan Kanwil - ${event.name}`,
    letterNumber: input.letterNumber,
    placeDate: city ? `${city}, ${letterDate}` : letterDate,
    subject: `Permohonan Pemberian Fasilitas Pabean, Cukai dan Perpajakan atas Penyelenggaraan Pameran ${event.name}`,
    recipient: [
      'Kepada Yth.',
      'Bapak Kepala Kantor Wilayah',
      'Direktorat Jenderal Bea dan Cukai',
      venue.customsRegionalOffice?.trim() ?? '',
    ],
    paragraphs: input.greeting ? [input.greeting, body] : [body],
    attachmentsIntro: 'Sebagai bahan pertimbangan, bersama surat ini kami lampirkan dokumen-dokumen sebagai berikut:',
    attachments: [
      'Surat Persetujuan sebagai Tempat Penyelenggaraan Pameran Berikat (TPPB);',
      'Lampiran uraian jenis barang dan nama peserta pameran yang akan dimasukkan ke TPPB;',
      'Memorandum of Understanding;',
      'NIB dan NPWP.',
    ],
    closing: 'Demikian permohonan ini kami sampaikan. Atas diterimanya permohonan ini, kami ucapkan terima kasih.',
    companyName: venue.operatorName?.trim() ?? '',
    signatories: venue.signatories,
  }
}
