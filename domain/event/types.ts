export type EventDisplayStatus = 'soon' | 'ongoing' | 'done'

export type EventLifecycle = 'ACTIVE' | 'CANCELLED' | 'ARCHIVED'

// Kelengkapan pekerjaan event — rollup dari job (docs/domain/event-data-definitions.md,
// StatusTuntasEvent): TANPA_JOB berarti belum ada pekerjaan sama sekali (bukan menggantung).
export type EventTuntasStatus = 'TUNTAS' | 'BELUM_TUNTAS' | 'TANPA_JOB'


export type EventInput = {
  name: string
  alias: string | null
  venueId: string
  eventOrganizerId: string
  picId: string
  startsOn: string
  endsOn: string
  // Penanda logistik venue (opsional): tanggal barang masuk/keluar venue, bukan tanggal pameran.
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
  // Id referensi (untuk preselect form edit) berdampingan namanya (untuk tampilan).
  venueId: string
  eventOrganizerId: string
  picId: string
  venueName: string
  eventOrganizerName: string
  picName: string
  startsOn: string
  endsOn: string
  moveInOn: string | null
  moveOutOn: string | null
  lifecycle: EventLifecycle
  displayStatus: EventDisplayStatus
  // Rollup job (turunan, tidak disimpan): kelengkapan pekerjaan + jumlah job yang belum tuntas
  // (dipakai peringatan arsip dan badge baris).
  tuntasStatus: EventTuntasStatus
  unfinishedJobs: number
}

// Agregat ringkasan yang ditampilkan di atas daftar (Requirement 16.1). Dihitung sisi-server;
// di sini hanya bentuknya.
export type EventListSummary = {
  totalEvents: number
  ongoingEvents: number
  totalExhibitors: number
  totalCiplItems: number
}

// Dua baris bentrok jadwal/venue untuk Attention_Panel (Requirement 16.6). Disimpan sebagai pasangan
// id + nama agar panel dapat menautkan tanpa query ulang.
export type EventScheduleOverlap = {
  firstEventId: string
  firstEventName: string
  secondEventId: string
  secondEventName: string
}

export type EventVenueConflict = {
  venueId: string
  venueName: string
  firstEventId: string
  firstEventName: string
  secondEventId: string
  secondEventName: string
}

// Data "perhatian" untuk Attention_Panel (Requirement 16.6): jadwal yang tumpang tindih dan venue
// yang dipakai dua event pada rentang yang beririsan.
export type EventListAttention = {
  scheduleOverlaps: EventScheduleOverlap[]
  venueConflicts: EventVenueConflict[]
}

// Hasil daftar utuh: baris + ringkasan agregat + data perhatian (Requirement 16.1/16.6). Satu objek
// agar Server Component dapat me-render seluruh dashboard dari satu kali baca.
export type EventListPage = {
  items: EventListItem[]
  summary: EventListSummary
  attention: EventListAttention
}

// ── Insight operasional (turunan event ACTIVE × jobs) ─────────────────────────────────────────
// Satu item insight: cukup identitas + tanggal + venue agar panel dapat menautkan ke detail event
// tanpa query ulang.

export type EventInsightItem = {
  id: string
  name: string
  startsOn: string
  endsOn: string
  venueName: string
}

// Konflik venue yang dikelompokkan per venue: daftar event di venue sama dengan rentang tanggal
// yang beririsan (gabungan pasangan unik, bukan pasangan mentah).
export type EventVenueConflictGroup = {
  venueName: string
  events: EventInsightItem[]
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

// Panel "Perlu tindakan" + statistik perencanaan. Semua turunan event ACTIVE; horizon tanggal
// dihitung terhadap "hari ini" sisi-server.
export type EventInsights = {
  // starts_on antara hari ini dan H+14, urut terdekat.
  dueSoon: EventInsightItem[]
  // starts_on antara hari ini dan H+30 tanpa satu pun job terkait — sinyal follow-up.
  soonWithoutJob: EventInsightItem[]
  // Pameran sudah lewat (ends_on < hari ini) namun masih ada job yang belum tuntas —
  // pekerjaan menggantung setelah pameran tutup; urut paling lama menggantung.
  unfinishedAfterShow: EventInsightItem[]
  // Venue dengan ≥2 event yang rentangnya beririsan.
  venueConflicts: EventVenueConflictGroup[]
  // Total pasangan event (venue apa pun) dengan jadwal beririsan.
  scheduleOverlapCount: number
  // ends_on < hari ini namun masih ACTIVE — kandidat arsip.
  archivable: EventInsightItem[]
  // Jumlah event ACTIVE per PIC, urut terbanyak.
  picLoad: EventNameCount[]
  // EO dengan event ACTIVE terbanyak (top 5).
  eoRanking: EventNameCount[]
  // Jumlah event ACTIVE per bulan mulai, urut bulan.
  perMonth: EventMonthCount[]
  // Venue dengan event ACTIVE terbanyak (top 5).
  venueRanking: EventNameCount[]
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

// ── Legacy (build lama, akan dihapus) ─────────────────────────────────────────────────────────
// Mengapa dipertahankan: clean cutover (DD-A4) memindahkan file ini ke bentuk redesign, tetapi
// beberapa modul build-lama MASIH mengimpor tipe-tipe di bawah dari sini dan BELUM termasuk scope
// task 8 (`lib/data-client.ts`, `domain/agent/types.ts`). Menghapusnya sekarang akan memutus
// `npx tsc --noEmit` dengan menyentuh kode di luar scope task ini. Mereka diisolasi di sini, bentuk
// aslinya dipertahankan apa adanya, dan dibuang saat konsumen lama diganti di slice berikutnya —
// bukan bagian dari model Event redesign di atas.

export type AccessLevel = 'ADMIN' | 'MEMBER'
export type JobRole = 'STAFF' | 'SUPERVISOR' | 'CUSTOMER_SERVICE' | 'DOCUMENT_ASSISTANT'

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

export type ExhibitorContact = Pick<Contact, 'name' | 'role' | 'email' | 'phone'>

type ExhibitorBase = {
  id: string
  eventId: string
  name: string
  contact: ExhibitorContact
  agentId: string | null
  createdAt: string
  createdById: string
  updatedAt: string
}

export type LocalExhibitor = ExhibitorBase & {
  kind: 'LOCAL'
  npwp: string | null
}

export type InternationalExhibitor = ExhibitorBase & {
  kind: 'INTERNATIONAL'
}

export type Exhibitor = LocalExhibitor | InternationalExhibitor
