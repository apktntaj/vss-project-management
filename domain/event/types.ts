export type EventDisplayStatus = 'soon' | 'ongoing' | 'done'

export type EventLifecycle = 'ACTIVE' | 'CANCELLED' | 'ARCHIVED'


export type EventInput = {
  name: string
  alias: string | null
  venueId: string
  eventOrganizerId: string
  picId: string
  startsOn: string
  endsOn: string
}
export type EventListQuery = {
  search?: string
  lifecycle?: EventLifecycle
  displayStatus?: EventDisplayStatus
}

export type EventListItem = {
  id: string
  name: string
  alias: string | null
  venueName: string
  eventOrganizerName: string
  picName: string
  startsOn: string
  endsOn: string
  lifecycle: EventLifecycle
  displayStatus: EventDisplayStatus
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
