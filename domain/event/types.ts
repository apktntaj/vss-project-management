import type { Role } from '@/domain/auth/types'
import type { EventAppointmentLetter } from '@/domain/event/appointment-letter'

export type EventDisplayStatus = 'unscheduled' | 'soon' | 'ongoing' | 'done'
export type EventLifecycle = 'ACTIVE' | 'CANCELLED' | 'ARCHIVED'
export type EventTuntasStatus = 'TUNTAS' | 'BELUM_TUNTAS' | 'TANPA_JOB'

export type EventInput = {
  name: string
  alias: string | null
  venueId: string | null
  eventOrganizerId: string | null
  picId: string | null
  startsOn: string | null
  endsOn: string | null
  moveInOn: string | null
  moveOutOn: string | null
}

export type EventListQuery = {
  search?: string
  lifecycle?: EventLifecycle
  displayStatus?: EventDisplayStatus
  picId?: string
}

export type EventListItem = {
  id: string
  name: string
  alias: string | null
  venueId: string | null
  eventOrganizerId: string | null
  picId: string | null
  venueName: string
  eventOrganizerName: string
  picName: string
  startsOn: string | null
  endsOn: string | null
  moveInOn: string | null
  moveOutOn: string | null
  lifecycle: EventLifecycle
  displayStatus: EventDisplayStatus
  jobCount: number
  tuntasStatus: EventTuntasStatus
  unfinishedJobs: number
  /** Surat penunjukan dari EO; null bila belum diunggah. */
  appointmentLetter: EventAppointmentLetter | null
}

// Hasil daftar: baris yang sudah tersaring. Halaman events hanya membutuhkan daftar ini; ringkasan
// agregat dan panel "perhatian" tidak dibaca siapa pun dan dihapus agar tiap render tidak membayar
// query yang tak terpakai.
export type EventListPage = {
  items: EventListItem[]
}

// ── Insight operasional (turunan event ACTIVE × jobs) ─────────────────────────────────────────
// Kalender venue activity (lihat `domain/event/venue-calendar.ts`): satu hari berwarna bila ≥2
// event di venue yang sama berlangsung hari itu (dengan hall yang sama pada mode bawaan).
export type VenueCalendarDay = {
  date: string
  // Jumlah event terbanyak yang berbagi satu hall pada hari ini (0/1 = tidak beririsan).
  overlapCount: number
  // Intensitas warna 0–4 (0 = tidak beririsan).
  level: 0 | 1 | 2 | 3 | 4
  // Kelompok yang beririsan hari ini beserta event-nya, terbanyak dulu. `hall` null pada mode
  // ANY_HALL (hall diabaikan — satu kelompok per venue).
  groups: { hall: string | null; events: { id: string; name: string }[] }[]
}

export type VenueCalendar = {
  startsOn: string // Senin pertama
  endsOn: string // Minggu terakhir
  // Hall yang beririsan pada hari mana pun dalam jendela, urut natural (kosong pada ANY_HALL).
  sharedHalls: string[]
  // Tepat 28 hari berurutan dari `startsOn`.
  days: VenueCalendarDay[]
}

// Satu venue pada daftar pilihan kalender venue activity.
export type VenueSummary = {
  venueId: string
  venueName: string
  eventCount: number
}

// Jadwal satu event untuk kalender venue (dihitung ulang di klien saat tanggal mulai/mode berganti).
export type VenueScheduleEvent = {
  id: string
  name: string
  startsOn: string | null
  endsOn: string | null
  venueId: string | null
  venueName: string
  /** Teks hall exhibitor event ini, unik, apa adanya (boleh kosong). */
  halls: readonly (string | null)[]
}

// Nama + jumlah untuk ranking (EO, venue) dan beban PIC.
export type EventNameCount = {
  name: string
  count: number
}

export type EventMonthCount = {
  month: string
  count: number
}

// Statistik turunan event ACTIVE untuk dashboard.
export type EventInsights = {
  // Seluruh event ACTIVE (semua usia) sebagai bahan kalender venue activity
  // (`domain/event/venue-calendar.ts`); kalendernya dihitung di dashboard.
  venueEvents: VenueScheduleEvent[]
  // Jumlah event ACTIVE per PIC, urut terbanyak.
  picLoad: EventNameCount[]
  // EO dengan event ACTIVE terbanyak (top 5).
  eoRanking: EventNameCount[]
  // Jumlah event ACTIVE per bulan mulai, urut bulan.
  perMonth: EventMonthCount[]
  // Venue dengan event ACTIVE terbanyak (top 5).
  venueRanking: EventNameCount[]
}

// Jadwal event ACTIVE yang dibutuhkan dashboard (kesiapan kedatangan + bobot event).
export type EventScheduleRef = {
  id: string
  name: string
  venueName: string
  startsOn: string | null
  endsOn: string | null
}

export type VenueInput = {
  legalName: string
  aliasName: string | null
  city: string | null
}

export type EventOrganizerInput = {
  legalName: string
}

export type VenueRecord = {
  id: string
  legalName: string
  aliasName: string | null
  city: string | null
}

export type EventOrganizerRecord = {
  id: string
  legalName: string
}

export type VenueSignatory = { name: string; title: string | null }

/** Data pengusaha TPPB pada venue: pemohon surat Kanwil & "organizer" di form rincian barang. */
export type VenueTppbProfile = {
  venueName: string
  city: string | null
  operatorName: string | null
  operatorNpwp: string | null
  operatorAddress: string | null
  /** Nama Kanwil DJBC tujuan, mis. "Banten". */
  customsRegionalOffice: string | null
  /** 0–2 entri; hanya penandatangan yang namanya terisi, urut 1 lalu 2. */
  signatories: VenueSignatory[]
}

// ── Legacy (build lama, akan dihapus) ─────────────────────────────────────────────────────────
// Mengapa dipertahankan: clean cutover (DD-A4) memindahkan file ini ke bentuk redesign, tetapi
// beberapa modul build-lama MASIH mengimpor tipe-tipe di bawah dari sini dan BELUM termasuk scope
// task 8 (`lib/data-client.ts`, `domain/agent/types.ts`). Menghapusnya sekarang akan memutus
// `npx tsc --noEmit` dengan menyentuh kode di luar scope task ini. Mereka diisolasi di sini, bentuk
// aslinya dipertahankan apa adanya, dan dibuang saat konsumen lama diganti di slice berikutnya —
// bukan bagian dari model Event redesign di atas.

export type AccessLevel = 'ADMIN' | 'MEMBER'
export type JobRole = Role

export type UserProfile = {
  id: string
  name: string
  email: string
  jobRole: JobRole
  accessLevel: AccessLevel
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type Contact = {
  name: string | null
  role: string | null
  email: string | null
  phone: string | null
  isPrimary: boolean
}

export type EventOrganizer = {
  id: string
  name: string
  npwp: string | null
  contacts: Contact[]
  address: string | null
  website: string | null
  createdAt: string
  updatedAt: string
}

export type Venue = {
  id: string
  name: string
  contacts: Contact[]
  address: string | null
  website: string | null
  loadingAccessNotes: string | null
  createdAt: string
  updatedAt: string
}

export type EventCancellation = {
  eventId: string
  reason: string
  cancelledAt: string
  cancelledById: string
}

export type Event = {
  id: string
  name: string
  venueId: string
  eventOrganizerId: string
  /** PIC: penanggung jawab event; berhak menghapus event. */
  picId: string | null
  startsOn: string
  endsOn: string
  createdAt: string
  createdById: string
  cancellation: EventCancellation | null
  venue?: Venue
  eventOrganizer?: EventOrganizer
}

/** Kontak satu orang (dipakai agent). Exhibitor punya domain sendiri di `domain/exhibitor/`. */
export type ExhibitorContact = Pick<Contact, 'name' | 'role' | 'email' | 'phone'>
