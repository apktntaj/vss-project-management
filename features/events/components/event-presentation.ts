// Mengapa: helper PRESENTASI murni bersama untuk komponen event (label + format tanggal). Dipisah
// agar EventCard (baca per-id) dan EventList (render dari daftar) memakai teks/label yang sama tanpa
// menggandakannya. Modul ini bebas efek: tanpa React, storage, Supabase — hanya pemetaan nilai →
// teks Indonesia. Boleh diimpor Server Component maupun leaf klien (tak ada sisi-server di sini).

import type { EventDisplayStatus, EventLifecycle } from '@/domain/event/types'

// Label Indonesia untuk display status (turunan tanggal, Req 16.5). Event tanpa tanggal
// (field kini opsional) berstatus 'unscheduled'.
export const DISPLAY_STATUS_LABEL: Record<EventDisplayStatus, string> = {
  unscheduled: 'Belum dijadwalkan',
  soon: 'Akan datang',
  ongoing: 'Berlangsung',
  done: 'Selesai',
}

// Kelas badge per display status — warna menandai makna.
export const DISPLAY_STATUS_BADGE: Record<EventDisplayStatus, string> = {
  unscheduled: 'bg-slate-100 text-slate-400',
  soon: 'bg-orange-50 text-orange-700',
  ongoing: 'bg-emerald-50 text-emerald-700',
  done: 'bg-slate-100 text-slate-600',
}

// Hari dari tanggal `from` ke `to` (ISO tanggal-saja, aritmetika UTC tanpa zona).
function daysUntil(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

// Label status tampilan: event mendatang ditampilkan sebagai hitungan hari ("42 hari lagi"),
// bukan label statis; Berlangsung/Selesai/Belum dijadwalkan tetap kata tetap.
export function displayStatusLabel(
  displayStatus: EventDisplayStatus,
  startsOn: string | null,
  today: string,
): string {
  if (displayStatus === 'soon' && startsOn) {
    return `${daysUntil(today, startsOn)} hari lagi`
  }
  return DISPLAY_STATUS_LABEL[displayStatus]
}

// Lifecycle administratif selain ACTIVE ditampilkan sebagai badge tambahan. ACTIVE adalah keadaan
// normal dan tidak diberi badge.
type InactiveLifecycle = Exclude<EventLifecycle, 'ACTIVE'>

const LIFECYCLE_LABEL: Record<InactiveLifecycle, string> = {
  CANCELLED: 'Dibatalkan',
  ARCHIVED: 'Diarsipkan',
}

const LIFECYCLE_BADGE: Record<InactiveLifecycle, string> = {
  CANCELLED: 'bg-rose-100 text-rose-700',
  ARCHIVED: 'bg-slate-200 text-slate-700',
}

// Badge lifecycle untuk ditampilkan: null bila ACTIVE (tanpa badge), selain itu label + kelas.
// Mengembalikan satu objek agar pemanggil tak perlu meng-index union penuh (menghindari error
// penyempitan tipe di titik render).
export function lifecycleBadge(
  lifecycle: EventLifecycle,
): { label: string; className: string } | null {
  if (lifecycle === 'ACTIVE') return null
  return { label: LIFECYCLE_LABEL[lifecycle], className: LIFECYCLE_BADGE[lifecycle] }
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agt',
  'Sep',
  'Okt',
  'Nov',
  'Des',
]

// Format satu tanggal YYYY-MM-DD → 'D Mon YYYY' tanpa membuat objek Date (hindari pergeseran
// timezone; domain menyimpan tanggal sebagai string tanpa zona).
export function formatDay(value: string): string {
  const [year, month, day] = value.split('-')
  const label = MONTHS[Number(month) - 1] ?? month
  return `${Number(day)} ${label} ${year}`
}

// Format ringkas tanpa tahun untuk tempat sempit (badge MI/MO) — konteks tahun sudah ada di
// rentang tanggal yang ditampilkan berdampingan.
export function formatDayShort(value: string): string {
  const [, month, day] = value.split('-')
  const label = MONTHS[Number(month) - 1] ?? month
  return `${Number(day)} ${label}`
}

// Format rentang tanggal. Bila bulan & tahun sama, tanggal mulai cukup angka harinya.
export function formatDateRange(startsOn: string, endsOn: string): string {
  const [startYear, startMonth] = startsOn.split('-')
  const [endYear, endMonth] = endsOn.split('-')
  if (startYear === endYear && startMonth === endMonth) {
    return `${Number(startsOn.split('-')[2])} – ${formatDay(endsOn)}`
  }
  return `${formatDay(startsOn)} – ${formatDay(endsOn)}`
}

// Format kunci bulan 'YYYY-MM' → 'Mon YYYY' (mis. '2026-06' → 'Jun 2026').
export function formatMonth(value: string): string {
  const [year, month] = value.split('-')
  const label = MONTHS[Number(month) - 1] ?? month
  return `${label} ${year}`
}
